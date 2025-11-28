# PingMyStay – Farmhouse Booking Application

End-to-end farmhouse booking platform with:

- 🧠 **FastAPI** backend (bookings, farmhouses, media upload, auth)
- 💾 **PostgreSQL** database (via Docker)
- 🌐 **SPA frontend served by Nginx**
- ☁️ **Azure Blob Storage** integration for media
- 🐳 **Docker Compose** for full local / server deployment

This README is the **single, combined, detailed documentation** for the whole application (backend + frontend + infrastructure).

---

## Table of Contents

1. [Architecture](#architecture)
2. [Tech Stack](#tech-stack)
3. [Repository Structure](#repository-structure)
4. [Prerequisites](#prerequisites)
5. [Configuration & Environment Variables](#configuration--environment-variables)  
   - [.env for Docker Compose](#env-for-docker-compose)
   - [Backend-only env vars](#backend-env-vars)
6. [Running the Stack with Docker Compose](#running-the-stack-with-docker-compose)
7. [Backend Service](#backend-service)
   - [Directory layout](#backend-directory-layout)
   - [Local dev without Docker](#local-backend-dev-without-docker-optional)
   - [Database initialization & seed admin](#database-initialization--seed-admin)
   - [Media storage & Azure integration](#media-storage--azure-integration)
   - [Authentication](#authentication)
   - [API Documentation](#api-documentation)
8. [Frontend Service](#frontend-service)
9. [Database Service](#database-service)
10. [Production-style Deployment on a Server](#production-style-deployment-on-a-server)
11. [Common Docker Commands](#common-docker-commands)
12. [Troubleshooting](#troubleshooting)
13. [Future Improvements](#future-improvements)

---

## Architecture

High-level overview:

- **PostgreSQL (db service)**  
  Runs as a Docker container, initialized with SQL scripts under `db/init`.

- **Backend (FastAPI)**
  - Container built from `backend/Dockerfile`
  - Talks to `db` over internal Docker network using `DATABASE_URL`
  - Exposes HTTP API on port `8000` **inside** the Docker network
  - Handles:
    - Authentication (JWT)
    - Farmhouse management
    - Booking flows
    - Media upload / SAS link generation via Azure

- **Frontend (SPA + Nginx)**
  - Container built from `frontend/Dockerfile`
  - Serves static assets over **port 80/443** to the outside world
  - Acts as the entrypoint for end users
  - Proxies API requests to `backend:8000` inside the Docker network (via `nginx.conf`)

- **Certbot + TLS (optional / production)**
  - `certbot/www` volume: ACME webroot for Let's Encrypt HTTP-01 challenges  
  - `certbot/conf` volume: stores issued TLS certificates
  - Mounted read-only into Nginx container to serve HTTPS

---

## Tech Stack

**Backend**

- Python 3.12 (official `python:3.12-slim` base)
- FastAPI + Uvicorn
- SQLAlchemy / psycopg2 (via `postgresql+psycopg2://` URL)
- JWT for auth
- Azure SDK for Blob Storage (for media uploads/SAS)

**Frontend**

- JavaScript SPA framework (built assets served by Nginx)
- Nginx as reverse proxy + static file server

**Infrastructure**

- Docker & Docker Compose
- PostgreSQL 15 (`postgres:15` image)
- Certbot + Let’s Encrypt (for HTTPS; optional but recommended)

---

## Repository Structure

From the root `pingmystay/` directory:

```text
pingmystay/
├── backend/
│   ├── Dockerfile
│   ├── main.py
│   ├── requirements.txt
│   ├── seed_admin.py
│   ├── uploads/              # Local dev upload dir (mapped in Docker)
│   └── ...                   # Backend modules, routers, models, etc.
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf            # Nginx config (mounted into container)
│   └── ...                   # Frontend source code / build output
│
├── db/
│   └── init/                 # SQL scripts run on first DB start
│       └── *.sql
│
├── certbot/
│   ├── www/                  # Webroot for ACME challenges (HTTP-01)
│   └── conf/                 # Let's Encrypt certs (mounted into Nginx)
│
├── docker-compose.yml
└── README.md                 # This file


Prerequisites

On the machine where you want to run the full stack (local laptop or remote server):

Docker (latest stable)

Docker Compose (usually built into docker CLI as docker compose)

A .env file in the project root containing required secrets

Optional (for production TLS):

A domain name pointing to your server’s IP (A record)

certbot CLI installed on the host

Configuration & Environment Variables
.env for Docker Compose

docker-compose.yml reads several values from your environment (or .env file in the root of the repo).

Create .env in the root:

cp .env.example .env   # if you create an example file


Or create .env manually with content similar to:

# Backend secrets
JWT_SECRET=super-strong-secret-change-me

# Azure blob storage
AZURE_STORAGE_ACCOUNT=yourstorageaccount
AZURE_STORAGE_KEY=your-storage-key
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER=media
AZURE_CONTAINER_ACCESS=private
AZURE_SAS_MINUTES=10080  # 7 days


Note: Any variable referenced in docker-compose.yml like ${VAR_NAME} or ${VAR_NAME:-default} should either exist here or in your shell environment.

Backend env vars

These are configured in docker-compose.yml for the backend service:

backend:
  environment:
    DATABASE_URL: postgresql+psycopg2://postgres:postgres@db:5432/farmbooking
    JWT_SECRET: ${JWT_SECRET}
    ACCESS_TOKEN_MINUTES: 120
    ACCESS_TOKEN_REMEMBER_MINUTES: 43200
    MAX_IMAGE_MB: 10
    MAX_VIDEO_MB: 100
    AZURE_STORAGE_ACCOUNT: ${AZURE_STORAGE_ACCOUNT}
    AZURE_STORAGE_KEY: ${AZURE_STORAGE_KEY}
    AZURE_STORAGE_CONNECTION_STRING: ${AZURE_STORAGE_CONNECTION_STRING}
    AZURE_STORAGE_CONTAINER: ${AZURE_STORAGE_CONTAINER:-media}
    AZURE_CONTAINER_ACCESS: ${AZURE_CONTAINER_ACCESS:-private}
    AZURE_SAS_MINUTES: ${AZURE_SAS_MINUTES:-10080}

Summary:

DATABASE_URL
SQLAlchemy/Postgres URL. In Docker, db is the hostname of the Postgres container.

JWT_SECRET
Secret key used to sign JWT access tokens. Must be strong and kept private.

ACCESS_TOKEN_MINUTES
Lifetime (in minutes) of a normal login token.

ACCESS_TOKEN_REMEMBER_MINUTES
Lifetime (in minutes) for “remember me” tokens.

MAX_IMAGE_MB, MAX_VIDEO_MB
Maximum upload sizes in MB (used by validation logic).

AZURE_* variables
Configure Azure Blob Storage. If your backend code supports it, leaving them empty may make the app fall back to local file storage (/app/uploads).

Running the Stack with Docker Compose

From the project root (pingmystay/):

1. Build and start everything

docker compose up --build


his will bring up:

db (Postgres 15)

backend (FastAPI + Uvicorn)

frontend (Nginx + SPA)

2. Access the app

Frontend UI:
Open your browser: http://localhost
(or http://<your-server-ip> if running on a remote host)

Backend API docs (if exposed directly for debugging):
Inside the Docker network it runs on backend:8000.
If you map a host port (e.g. 8000:8000), you can open:
http://localhost:8000/docs

In the given docker-compose.yml, only frontend service exposes ports 80/443 to the outside. The backend is only reachable from inside the Docker network (via Nginx proxy).


Backend Service
Backend Dockerfile (summary)

backend/Dockerfile:

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

RUN mkdir -p /app/uploads

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


Installs dependencies from backend/requirements.txt

Copies the backend source code into /app

Creates /app/uploads as a local upload directory

Starts Uvicorn on port 8000

Backend directory layout

Typical structure:

backend/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── seed_admin.py            # Script to create an initial admin user
├── uploads/                 # Local media storage
├── app/                     # (or equivalent package)
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── routers/             # FastAPI routers (auth, farms, bookings, media, etc.)
│   ├── services/            # Business logic
│   └── core/                # Config, security, utils
└── ...


Local backend dev without Docker (optional)

If you want to run the backend directly on your machine:

Create and activate a virtual environment:

cd backend
python3 -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate


Install dependencies:

pip install --upgrade pip
pip install -r requirements.txt


Set environment variables (match docker-compose.yml):

export DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/farmbooking"
export JWT_SECRET="super-strong-secret"
# ... set any AZURE_* variables as needed


Run the app:

uvicorn main:app --reload --host 0.0.0.0 --port 8000


For this mode, you must also have Postgres running locally and a farmbooking database created.

Database initialization & seed admin

The DB container is configured in docker-compose.yml:

db:
  image: postgres:15
  restart: unless-stopped
  environment:
    POSTGRES_DB: farmbooking
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  volumes:
    - dbdata:/var/lib/postgresql/data
    - ./db/init:/docker-entrypoint-initdb.d:ro


On first start, Postgres will run all .sql files in ./db/init to initialize schema/data.

Data is persisted in the dbdata volume.

Seed admin user

backend/seed_admin.py is used to create an initial admin account.

From inside the running backend container:

docker compose exec backend bash
python seed_admin.py


This script will:

Connect to the database via DATABASE_URL

Create an admin user if one does not exist

Check the seed_admin.py file to see the default admin email/password and change them as needed after first login.

Media storage & Azure integration

The backend supports media (images/videos) for farmhouses.

There are usually two modes:

Local storage (dev)
Files are stored on disk under /app/uploads (mapped to ./backend/uploads on host if you add a volume):

backend:
  volumes:
    - ./backend/uploads:/app/uploads


Azure Blob Storage (recommended for staging/prod)
When AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, and AZURE_STORAGE_CONNECTION_STRING are set:

Uploads are sent to the configured container (default media)

The API can issue SAS URLs for public/temporary access, controlled by AZURE_SAS_MINUTES.

AZURE_CONTAINER_ACCESS controls container access level (private, blob, etc., depending on your implementation).

Backend logic typically:

Validates file size against MAX_IMAGE_MB / MAX_VIDEO_MB

Accepts upload

Either:

saves locally, or

uploads to Azure Blob Storage and returns a URL (or SAS URL)

Authentication

Authentication is JWT-based.

JWT_SECRET is used to sign tokens.

Access tokens expire after ACCESS_TOKEN_MINUTES.

“Remember me” tokens expire after ACCESS_TOKEN_REMEMBER_MINUTES.

Typical flows:

POST /auth/login: username/password → JWT token

POST /auth/refresh: refresh or remember-me handling

Protected endpoints use Authorization: Bearer <token>

(See API docs below for exact endpoints.)

API Documentation

FastAPI automatically exposes interactive docs (OpenAPI/Swagger):

If backend is mapped to host port 8000:
http://localhost:8000/docs

If only accessible via Nginx, you may expose a route like:
https://your-domain.com/api/docs (depends on nginx.conf configuration)

From there you can:

Explore all endpoints

Test APIs directly

See request/response schemas

Frontend Service

frontend is built and served via Nginx.

Compose configuration

From docker-compose.yml:

frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile
  restart: unless-stopped
  ports:
    - "80:80"
    - "443:443"
  depends_on:
    - backend
  volumes:
    - ./frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./certbot/www:/var/www/certbot:ro
    - ./certbot/conf:/etc/letsencrypt:ro


Key points:

Ports:

80:80 → HTTP

443:443 → HTTPS (if certs present in ./certbot/conf)

Config:

nginx.conf controls:

Static asset serving (the built SPA)

Reverse proxy rules to backend (proxy_pass http://backend:8000;)

TLS configuration (cert/key paths under /etc/letsencrypt)

Frontend Dockerfile (typical pattern)

Your frontend/Dockerfile will roughly:

Use a Node image to build the app (npm install + npm run build).

Copy the build output into an Nginx image.

Serve files from /usr/share/nginx/html.

If the build produces a dist directory, you’ll see something like:

FROM node:XX AS build
WORKDIR /app
COPY frontend/package*.json .
RUN npm install
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html


Adjust according to your actual setup; the above is the standard pattern.

Database Service

From docker-compose.yml:

db:
  image: postgres:15
  restart: unless-stopped
  environment:
    POSTGRES_DB: farmbooking
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
  volumes:
    - dbdata:/var/lib/postgresql/data
    - ./db/init:/docker-entrypoint-initdb.d:ro


DB name: farmbooking

User: postgres

Password: postgres

Data: stored in dbdata Docker volume (persists between restarts)

Initialization scripts: any .sql in ./db/init run on first start

You can connect from your host (if you expose a port) or from a DB GUI by mapping port 5432 in compose:

db:
  ports:
    - "5432:5432"


(For production, you may not want to expose the DB publicly.)

Production-style Deployment on a Server
1. Clone the repo
git clone <your-repo-url> pingmystay
cd pingmystay

2. Create .env

As described above, set JWT_SECRET and Azure values.

3. Set DNS

Create an A record pointing your-domain.com → server’s public IP.

4. Obtain TLS certificates (Let’s Encrypt + webroot)

On the host (not in Docker):

sudo mkdir -p certbot/www certbot/conf

# Start only frontend once to ensure /var/www/certbot is reachable
docker compose up -d frontend

# Request cert (example)
sudo certbot certonly \
  --webroot \
  -w $(pwd)/certbot/www \
  -d your-domain.com \
  --email you@example.com \
  --agree-tos \
  --no-eff-email


This writes certs into ./certbot/conf

Nginx container mounts these into /etc/letsencrypt read-only

5. Start full stack
docker compose up --build -d


Access:

https://your-domain.com → SPA UI

SPA → Nginx → backend → database

Common Docker Commands

From repo root:

Build & start in foreground
docker compose up --build

Start in background
docker compose up -d

Stop all services
docker compose down

View logs

All services:

docker compose logs -f


Specific service (e.g. backend):

docker compose logs -f backend

Rebuild only backend
docker compose build backend
docker compose up -d backend

Exec into a container

Backend:

docker compose exec backend bash


DB:

docker compose exec db bash

Troubleshooting
Backend container cannot connect to DB

Symptoms:

Backend logs show connection errors

DB container may have restarted

Check:

docker compose logs db

Ensure POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD match your DATABASE_URL.

Ensure DB is healthy before backend starts (compose’s depends_on handles ordering, but DB may still be initializing).

API calls from frontend fail (4xx/5xx)

Check frontend/nginx.conf:

Is it proxying API requests to http://backend:8000?

Are paths correct? (/api/ vs / etc.)

Check backend logs: docker compose logs -f backend.

SSL not working

Ensure certbot/conf actually contains live/your-domain.com directory.

Verify Nginx TLS config uses paths like:

ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;


Ensure ports 80 and 443 are open in firewall / security groups.

Azure upload errors

Confirm AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, and AZURE_STORAGE_CONNECTION_STRING are correct.

Check that container AZURE_STORAGE_CONTAINER exists (media by default).

Future Improvements

Some ideas you might implement later:

CI/CD (Bitbucket Pipelines / GitHub Actions) to build and push Docker images

Proper migration tooling (Alembic) instead of manual SQL in db/init

Centralized logging (e.g. Loki, ELK)

Metrics & health checks (Prometheus/Grafana)

Horizontal scaling of backend and frontend in Kubernetes or ECS

If you share more details of your actual frontend build commands or any extra backend features/endpoints, I can extend this README with those specifics (API reference, example requests, etc.).
