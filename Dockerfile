# ============================================================
# Multi-Stage Unified Dockerfile for Google Cloud Run
# Serves React Frontend SPA + FastAPI Backend from ONE container
# Scale-to-zero: $0.00 idle cost
# Build context: project root (not backend/)
# ============================================================

# Stage 1: Build React Frontend with Node.js
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# Copy frontend package files and install dependencies
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund

# Copy frontend source and build production bundle
COPY frontend/ ./
RUN npm run build

# Stage 2: Install Python Backend Dependencies
FROM python:3.11-slim AS backend-builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 3: Final Minimal Execution Image
FROM python:3.11-slim

WORKDIR /app

# Copy installed Python dependencies from builder
COPY --from=backend-builder /install /usr/local

# Copy backend application source
COPY backend/main.py .

# Copy built frontend dist into /app/static/ for FastAPI to serve
COPY --from=frontend-builder /frontend/dist ./static/

# Environment configuration for Cloud Run
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Start Uvicorn server
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
