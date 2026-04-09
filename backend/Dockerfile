FROM python:3.11-slim

# Make Python output visible in Railway logs in real time. Without these,
# stdout/stderr are buffered in non-TTY mode and we see no startup output
# at all — making any import-time crash invisible.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Shell form so ${PORT} expands at runtime (Railway injects PORT dynamically).
# Migrations run in a background task from main.py's lifespan so the HTTP
# port binds immediately and Railway's healthcheck passes without waiting
# for the initial (potentially slow) migration to finish.
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"
