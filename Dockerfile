# Просто запускаем docker‑compose внутри контейнера
FROM docker/compose:latest

WORKDIR /app
COPY . /app

CMD ["docker-compose", "up"]
