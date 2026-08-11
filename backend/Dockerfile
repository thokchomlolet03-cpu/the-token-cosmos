# Multi-stage Dockerfile for Google Cloud Run ($0.00 Idle Cost CPU Container)
FROM python:3.11-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final minimal execution stage
FROM python:3.11-slim

WORKDIR /app

# Copy installed dependencies from builder stage
COPY --from=builder /install /usr/local

# Copy backend application source code
COPY main.py .

# Environment configuration for Cloud Run
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Start Uvicorn server bound to 0.0.0.0 and Cloud Run $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
