# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /app/frontend
RUN npm ci

# Copy the rest of the application code
COPY frontend/ ./

# Build the application
RUN npm run build

# Stage 2: Run the API and serve the compiled SPA from one Cloud Run container.
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/main.py ./main.py
COPY --from=builder /app/frontend/dist ./static

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
