# 🏡 Farmhouse Booking System

A full-stack web application for managing farmhouse bookings with **Admin** and **Owner** roles.  
The system provides **calendar availability management, media uploads, and owner administration** in a modern, responsive UI.  

Built with:
- **Frontend:** React (Vite + Nginx)
- **Backend:** FastAPI + SQLAlchemy + JWT Auth
- **Database:** PostgreSQL 16
- **Containerization:** Docker & Docker Compose

---

## ✨ Features

- 🔑 **Authentication & Roles**
  - JWT-based login
  - Role-based access (Admin / Owner)

- 📅 **Booking Calendar**
  - View and manage farmhouse availability
  - Mark dates as booked or available
  - Filter farmhouses by availability

- 📷 **Media Management**
  - Upload images & videos for each farmhouse
  - Delete media assets
  - Media served via `/uploads`

- 👤 **Admin Features**
  - Create & manage owners
  - Enable/disable accounts
  - Reset owner passwords
  - Update owner contact details

- 🎨 **Modern UI**
  - Dark/light theme toggle
  - Responsive design
  - Skeleton loaders and toasts
  - Calendar with visual booking status

---

## 📂 Project Structure

farmhouse-booking/
│
├── backend/ # FastAPI application
│ ├── main.py # API entrypoint
│ ├── models/ # SQLAlchemy models
│ ├── routes/ # API routes (auth, farmhouses, media, admin)
│ ├── uploads/ # Media upload storage (mounted volume)
│ └── Dockerfile
│
├── frontend/ # React (Vite) frontend
│ ├── src/ # React components
│ ├── index.css # Styling (dark/light, calendar, modals)
│ ├── nginx.conf # Reverse proxy config
│ └── Dockerfile
│
├── db/ # Database initialization
│ └── init/01_schema.sql # Schema setup (tables, indexes)
│
├── docker-compose.yml # Orchestration
└── README.md


---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/farmhouse-booking.git
cd farmhouse-booking


2. Environment Variables

Create a .env file in the root:
# Backend
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=farmhouse
JWT_SECRET=change-me-please
ADMIN_EMAIL=admin@farm.local
ADMIN_PASSWORD=Admin@123

# Database
POSTGRES_PORT=5432

# Frontend
VITE_API_URL=/api


⚠️ Important:

Replace JWT_SECRET with a strong secret key in production.

Default admin will be created with credentials above.

3. Run with Docker Compose

docker compose up -d --build


Services:

Frontend: http://localhost:8080

Backend API: http://localhost:8080/api

Postgres DB: localhost:5432


Database Schema

users → stores admins & owners

farmhouses → farmhouse details

day_status → booking/availability per day

media_assets → uploaded images/videos

Schema auto-initialized via db/init/01_schema.sql



Authentication Flow

User logs in via /api/auth/login → receives JWT.

JWT used in Authorization: Bearer <token> header.

Role is decoded from token → grants access to Admin or Owner endpoints.


API Overview

Some key endpoints:

Auth

POST /api/auth/login → login

GET /api/me → get current user

Farmhouses

GET /api/farmhouses → list farmhouses

GET /api/farmhouses/{id}/calendar → get availability

POST /api/farmhouses/{id}/calendar → update availability

Media

POST /api/farmhouses/{id}/media → upload file

DELETE /api/media/{id} → delete file

Admin

POST /api/admin/owners → create owner

PUT /api/admin/owners/{id}/reset-password → reset password

PATCH /api/admin/owners/{id}/status → enable/disable owner