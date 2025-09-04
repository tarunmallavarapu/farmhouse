import os
from datetime import datetime, timedelta, date
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy import create_engine, ForeignKey, String, Boolean, Date, func, select, and_, or_, text, exists
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker, Session

# --------------------- App (CREATE FIRST) ---------------------
app = FastAPI(title="Farmhouse Booking API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

# --------------------- Config ---------------------
# default points to 'db' so it works inside the container even if env missing
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@db:5432/farmbooking"
)
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-please")
JWT_ALG = "HS256"
ACCESS_MIN = int(os.getenv("ACCESS_TOKEN_MINUTES", "120"))

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

# --------------------- Models ---------------------
class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # 'owner' | 'admin'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # NEW
    farmhouses: Mapped[List["Farmhouse"]] = relationship(back_populates="owner")

class Farmhouse(Base):
    __tablename__ = "farmhouses"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # NEW
    size: Mapped[Optional[int]] = mapped_column(nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    owner: Mapped[User] = relationship(back_populates="farmhouses")
    days: Mapped[List["DayStatus"]] = relationship(back_populates="farmhouse", cascade="all, delete-orphan")


class DayStatus(Base):
    __tablename__ = "day_status"
    id: Mapped[int] = mapped_column(primary_key=True)
    farmhouse_id: Mapped[int] = mapped_column(ForeignKey("farmhouses.id"), nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    is_booked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[Optional[str]]
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    farmhouse: Mapped[Farmhouse] = relationship(back_populates="days")

# --------------------- Schemas ---------------------
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str

class FarmhouseIn(BaseModel):
    name: str
    owner_id: int

class FarmhouseOut(BaseModel):
    id: int
    name: str
    owner_id: int
    size: Optional[int] = None
    location: Optional[str] = None
    class Config:
        from_attributes = True

class DayStatusIn(BaseModel):
    day: date
    is_booked: bool
    note: Optional[str] = None

class DayStatusOut(BaseModel):
    day: date
    is_booked: bool
    note: Optional[str] = None

class AdminCreateOwnerIn(BaseModel):
    username: str
    password: str
    farmhouse_name: str
    email: str
    size: int
    location: str
    phone: str        

class FarmhouseBrief(BaseModel):
    id: int
    name: str
    size: Optional[int] = None
    location: Optional[str] = None
    class Config:
        from_attributes = True

class AdminOwnerRowOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None                 
    is_active: bool = True
    farmhouses: List[FarmhouseBrief] = []


class PagedOwnersOut(BaseModel):
    items: List["AdminOwnerRowOut"]
    total: int
    page: int
    page_size: int
    pages: int

class OwnerContactUpdateIn(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


class OwnerSetActiveIn(BaseModel):
    active: bool

class ResetPasswordIn(BaseModel):
    new_password: str


# --------------------- DB utils ---------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --------------------- Auth utils ---------------------
def hash_password(pw: str) -> str:
    # plaintext store (intentionally insecure for your request)
    return pw

def verify_password(pw: str, stored: str) -> bool:
    # plaintext comparison
    return pw == stored

def create_access_token(sub: str, role: str) -> str:
    payload = {"sub": sub, "role": role, "exp": datetime.utcnow() + timedelta(minutes=ACCESS_MIN)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None)
) -> "User":
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        ident = payload.get("sub")  # email OR username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.scalar(select(User).where(or_(User.email == ident, User.username == ident)))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if user.role != "admin" and not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    return user

# --------------------- Startup ---------------------
@app.on_event("startup")
def _init():
    # Tables are created by SQL in /docker-entrypoint-initdb.d on first run,
    # but this is harmless if they already exist.
    Base.metadata.create_all(engine)

# --------------------- Auth endpoints ---------------------
@app.post("/auth/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.scalar(
        select(User).where(or_(User.email == form.username, User.username == form.username))
    )
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.role != "admin" and not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    token = create_access_token(sub=user.email or user.username, role=user.role)
    return TokenOut(access_token=token, role=user.role, email=user.email or user.username)


# --------------------- Farmhouse endpoints ---------------------
@app.get("/me/farmhouses", response_model=List[FarmhouseOut])
def my_farmhouses(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user)
):
    if current.role == "owner":
        rows = db.scalars(select(Farmhouse).where(Farmhouse.owner_id == current.id)).all()
    else:
        rows = db.scalars(select(Farmhouse)).all()
    return rows

@app.post("/farmhouses", response_model=FarmhouseOut, status_code=201)
def create_farmhouse(
    payload: FarmhouseIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user)
):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    owner = db.get(User, payload.owner_id)
    if not owner or owner.role != "owner":
        raise HTTPException(status_code=400, detail="owner_id must refer to an owner user")
    fh = Farmhouse(name=payload.name, owner_id=payload.owner_id)
    db.add(fh)
    db.commit(); db.refresh(fh)
    return fh

# --------------------- Calendar endpoints ---------------------
@app.get("/farmhouses/{fid}/status", response_model=List[DayStatusOut])
def get_status(
    fid: int,
    start: date,
    end: date,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user)
):
    fh = db.get(Farmhouse, fid)
    if not fh:
        raise HTTPException(status_code=404, detail="Farmhouse not found")
    if current.role == "owner" and fh.owner_id != current.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    rows = db.scalars(
        select(DayStatus).where(
            and_(DayStatus.farmhouse_id == fid, DayStatus.day >= start, DayStatus.day <= end)
        ).order_by(DayStatus.day)
    ).all()
    return [DayStatusOut(day=r.day, is_booked=r.is_booked, note=r.note) for r in rows]

@app.put("/farmhouses/{fid}/status", status_code=204)
def upsert_status(
    fid: int,
    changes: List[DayStatusIn],
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user)
):
    fh = db.get(Farmhouse, fid)
    if not fh:
        raise HTTPException(status_code=404, detail="Farmhouse not found")

    # Owners only for their own farmhouse
    if current.role != "owner" or fh.owner_id != current.id:
        raise HTTPException(status_code=403, detail="Owners only")

    today = date.today()
    for c in changes:
        if c.day < today:
            raise HTTPException(status_code=400, detail="Cannot modify past dates")
        existing = db.scalar(
            select(DayStatus).where(and_(DayStatus.farmhouse_id == fid, DayStatus.day == c.day))
        )
        if existing:
            existing.is_booked = c.is_booked
            existing.note = c.note
        else:
            db.add(DayStatus(farmhouse_id=fid, day=c.day, is_booked=c.is_booked, note=c.note))
    db.commit()
    return

# --------------------- Admin management endpoints ---------------------
@app.get("/admin/owners", response_model=PagedOwnersOut)
def admin_list_owners(
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    allowed = {10, 25, 50, 75, 100}
    if page_size not in allowed:
        page_size = 25
    if page < 1:
        page = 1

    total = db.scalar(select(func.count()).select_from(User).where(User.role == "owner")) or 0
    pages = max(1, (total + page_size - 1) // page_size)
    if total == 0:
        return PagedOwnersOut(items=[], total=0, page=1, page_size=page_size, pages=1)

    if page > pages:
        page = pages

    offset = (page - 1) * page_size
    owners = db.scalars(
        select(User)
        .where(User.role == "owner")
        .order_by(User.id.asc())
        .offset(offset)
        .limit(page_size)
    ).all()

    items: List[AdminOwnerRowOut] = []
    for o in owners:
        fhs = db.scalars(select(Farmhouse).where(Farmhouse.owner_id == o.id)).all()
        items.append(AdminOwnerRowOut(
            id=o.id, username=o.username, email=o.email, phone=o.phone, is_active=o.is_active,
            farmhouses=[FarmhouseBrief.model_validate(fh) for fh in fhs],
        ))
    return PagedOwnersOut(items=items, total=total, page=page, page_size=page_size, pages=pages)

@app.patch("/admin/owners/{owner_id}/contact", status_code=204)
def admin_update_owner_contact(
    owner_id: int,
    payload: OwnerContactUpdateIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    user = db.get(User, owner_id)
    if not user or user.role != "owner":
        raise HTTPException(status_code=404, detail="Owner not found")

    if payload.email is None and payload.phone is None:
        raise HTTPException(status_code=400, detail="Provide email and/or phone to update")

    # Email uniqueness validation
    if payload.email is not None:
        email = payload.email.strip()
        if email:
            clash = db.scalar(select(User).where(and_(User.email == email, User.id != owner_id)))
            if clash:
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = email
        else:
            user.email = None  # allow clearing if you want; remove if you don't

    # Phone validation: 7–15 digits
    if payload.phone is not None:
        phone = payload.phone.strip()
        digits = "".join(ch for ch in phone if ch.isdigit())
        if phone and (len(digits) < 7 or len(digits) > 15):
            raise HTTPException(status_code=400, detail="Enter a valid phone number (7–15 digits).")
        user.phone = phone if phone else None

    db.commit()


@app.post("/admin/owners/{owner_id}/reset-password", status_code=204)
def admin_reset_owner_password(owner_id: int, payload: ResetPasswordIn,
                               db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    user = db.get(User, owner_id)
    if not user or user.role != "owner":
        raise HTTPException(status_code=404, detail="Owner not found")
    user.password_hash = hash_password(payload.new_password)
    db.commit()


@app.post("/admin/owners/{owner_id}/set-active", status_code=204)
def admin_owner_set_active(owner_id: int, payload: OwnerSetActiveIn,
                           db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    user = db.get(User, owner_id)
    if not user or user.role != "owner":
        raise HTTPException(status_code=404, detail="Owner not found")
    user.is_active = bool(payload.active)
    db.commit()

@app.post("/admin/owners/create", response_model=FarmhouseOut, status_code=201)
def admin_create_owner(payload: AdminCreateOwnerIn, db: Session = Depends(get_db),
                       current: User = Depends(get_current_user)):
    if current.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")

    # Uniqueness checks
    if db.scalar(select(User).where(User.username == payload.username)) or \
       db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="User already exists")

    if payload.size <= 0:
        raise HTTPException(status_code=400, detail="Size must be a positive integer")

    # ---- Phone validation (required here even if DB allows NULL) ----
    phone = payload.phone.strip()
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits or len(digits) < 7 or len(digits) > 15:
        raise HTTPException(status_code=400, detail="Enter a valid phone number (7–15 digits).")

    owner = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="owner",
        is_active=True,
        phone=phone,                               # NEW
    )
    db.add(owner); db.flush()

    fh = Farmhouse(
        name=payload.farmhouse_name,
        owner_id=owner.id,
        size=payload.size,
        location=payload.location,
    )
    db.add(fh); db.commit(); db.refresh(fh)
    return fh

@app.get("/farmhouses/available", response_model=List[FarmhouseOut])
def available_farmhouses(
    date: date,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user)
):
    # A farmhouse is "available" if there is NOT a booked row for that date.
    booked_exists = exists(
        select(DayStatus.id).where(
            and_(
                DayStatus.farmhouse_id == Farmhouse.id,
                DayStatus.day == date,
                DayStatus.is_booked == True
            )
        )
    )
    q = select(Farmhouse).where(~booked_exists)

    # Owners only see their own farmhouses
    if current.role == "owner":
        q = q.where(Farmhouse.owner_id == current.id)

    rows = db.scalars(q).all()
    return rows