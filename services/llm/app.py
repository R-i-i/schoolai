from fastapi import FastAPI
app=FastAPI()
@app.post('/solve')
async def solve(req:dict):
    return [{'type':'step','content':'stub step'}]
