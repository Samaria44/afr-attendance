FROM python:3.12-slim

# System deps for OpenCV headless + insightface
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps — cache bust: 2026-08-18
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Pre-download InsightFace model so first request is not slow
RUN python -c "from app.services.face_service import get_face_app; get_face_app()" || true

EXPOSE 8000

# Shell form so $PORT env var is expanded at runtime
# Railway sets $PORT automatically; defaults to 8000 for local Docker
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
