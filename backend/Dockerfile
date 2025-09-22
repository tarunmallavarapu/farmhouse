
FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Create default upload dir
RUN mkdir -p /app/uploads

ENV DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/farmbooking \
    JWT_SECRET=change-me-please \
    ACCESS_TOKEN_MINUTES=120 \
    UPLOAD_DIR=/app/uploads \
    MAX_IMAGE_MB=10 \
    MAX_VIDEO_MB=100

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
