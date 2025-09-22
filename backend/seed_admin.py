# backend/seed_admin.py
from sqlalchemy import select, or_
from main import SessionLocal, User, hash_password

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@farm.local"
ADMIN_PASSWORD = "Admin@123"

with SessionLocal() as db:
    existing = db.scalar(
        select(User).where(or_(User.username == ADMIN_USERNAME, User.email == ADMIN_EMAIL))
    )
    if existing:
        print("Admin already exists")
    else:
        db.add(User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),  # plaintext per current setup
            role="admin",
            is_active=True,
            phone="+10000000000", 
        ))
        db.commit()
        print("Admin created: username=admin, email=admin@farm.local, password=Admin@123")

