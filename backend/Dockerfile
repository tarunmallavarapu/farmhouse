FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
PYTHONUNBUFFERED=1
WORKDIR /app


# System deps (psycopg2 build not needed with psycopg2-binary)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


COPY backend/ .


# Sensible defaults; overridden by docker-compose/.env
ENV DATABASE_URL=postgresql+psycopg2://postgres:postgres@db:5432/farmbooking \
JWT_SECRET=change-me-please \
ACCESS_TOKEN_MINUTES=120


EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]