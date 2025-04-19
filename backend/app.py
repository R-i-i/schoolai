"""SchoolAI – FastAPI backend (v0.5.0) with SSE streaming"""
from __future__ import annotations
import asyncio, json, uuid
from datetime import datetime
from typing import AsyncGenerator, List, Literal
import httpx, boto3, redis.asyncio as aioredis
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, BaseSettings, Field, constr
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncEngine

class Settings(BaseSettings):
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_db: str = "schoolai"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    redis_url: str = "redis://redis:6379/0"
    minio_endpoint: str = "http://minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    ocr_url: str = "http://ocr:9002"
    llm_url: str = "http://llm:9003"
    class Config:
        env_file = ".env"
settings = Settings()

DATABASE_URL = f"postgresql+asyncpg://{settings.postgres_user}:{settings.postgres_password}@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
db_engine: AsyncEngine = create_async_engine(DATABASE_URL, pool_pre_ping=True, echo=False)
AsyncSessionLocal = async_sessionmaker(db_engine, expire_on_commit=False)
redis = aioredis.from_url(settings.redis_url, decode_responses=True)
s3_client = boto3.client("s3", endpoint_url=settings.minio_endpoint,
    aws_access_key_id=settings.minio_access_key,
    aws_secret_access_key=settings.minio_secret_key)

app = FastAPI(title="SchoolAI", version="0.5.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

class Registration(BaseModel):
    full_name: constr(min_length=2)
    birth_date: constr(regex=r"^\d{4}-\d{2}-\d{2}$")
    grade: int = Field(..., ge=1, le=11)
    native_language: Literal["ru","en","sah"] = "ru"

class TaskRequest(BaseModel):
    input_type: Literal["ocr","text","reference"]
    payload: str
    subject: str
    grade: int
    language: str="ru"

class StepResponse(BaseModel):
    type: Literal["step","clarify","motivate","error"]
    content: str

async def run_ocr(file: UploadFile)->str:
    data = await file.read()
    files={"file":(file.filename,data,file.content_type)}
    async with httpx.AsyncClient() as client:
        r=await client.post(f"{settings.ocr_url}/ocr",files=files); r.raise_for_status()
    return r.json().get("text","")

async def fetch_llm(req: TaskRequest)->List[StepResponse]:
    async with httpx.AsyncClient() as client:
        r=await client.post(f"{settings.llm_url}/solve",json=req.dict()); r.raise_for_status()
    return [StepResponse(**o) for o in r.json()]

@app.post("/register")
async def register(data: Registration, db: AsyncSession = Depends(get_db)):
    uid=str(uuid.uuid4())
    await db.execute(text("INSERT INTO users(id,full_name,birth_date,grade,native_language) VALUES (:i,:f,:b,:g,:l)"),{"i":uid,"f":data.full_name,"b":data.birth_date,"g":data.grade,"l":data.native_language})
    await db.commit()
    return {"user_id":uid}

@app.post("/media/ocr")
async def media_ocr(file: UploadFile=File(...)):
    if file.content_type not in {"image/png","image/jpeg","image/webp"}:
        raise HTTPException(415,"Unsupported image type")
    return {"text":await run_ocr(file)}

@app.post("/task/solve",response_model=List[StepResponse])
async def task_solve(req: TaskRequest):
    return await fetch_llm(req)

@app.post("/task/solve/stream")
async def task_solve_stream(req: TaskRequest):
    steps=await fetch_llm(req)
    async def gen():
        for s in steps:
            yield f"event:{s.type}\ndata:{json.dumps(s.dict())}\n\n"
            await asyncio.sleep(0.05)
    return StreamingResponse(gen(),media_type="text/event-stream")

@app.post("/user/reward/{uid}")
async def add_star(uid:str):
    month=datetime.utcnow().strftime("%Y%m")
    await redis.zincrby(f"stars:{uid}:{month}",1,"star")
    await redis.publish("stars",f"{uid}:{month}:1")
    return {"ok":True}

@app.get("/user/progress/{uid}")
async def progress(uid:str):
    month=datetime.utcnow().strftime("%Y%m")
    total=0
    async for k in redis.scan_iter(f"stars:{uid}:*"):
        total+=await redis.zscore(k,"star") or 0
    monthly=await redis.zscore(f"stars:{uid}:{month}","star") or 0
    return {"total":int(total),"monthly":int(monthly)}

@app.on_event("shutdown")
async def _close():
    await redis.close(); await db_engine.dispose()

if __name__=="__main__": import uvicorn; uvicorn.run("app:app",host="0.0.0.0",port=8000,reload=True)
