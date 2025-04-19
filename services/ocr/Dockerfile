FROM python:3.11-slim
RUN apt-get update && apt-get install -y libgl1 git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install fastapi "uvicorn[standard]" paddleocr
COPY . /app
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","9002"]
