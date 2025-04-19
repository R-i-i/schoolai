FROM python:3.11-slim

# Устанавливаем системные библиотеки
RUN apt-get update && apt-get install -y libgl1 git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем только requirements
COPY backend/requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь бекенд‑код
COPY backend /app

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
