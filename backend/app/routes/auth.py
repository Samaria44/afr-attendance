import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from app.core.database import get_database
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user, require_permission, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ── Schemas ───────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username:  str = Field(..., min_length=3, max_length=30)
    password:  str = Field(..., min_length=6, max_length=72)
    full_name: str = Field(..., min_length=1, max_length=100)
    role:      str = Field(default="operator")


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         dict


# ── GET /api/auth/status  (public) ───────────────────────────────
@router.get("/status")
async def auth_status():
    db = get_database()
    count = await db["users"].count_documents({})
    return {"has_users": count > 0}


# ── POST /api/auth/register  (first-run only) ────────────────────
@router.post("/register", status_code=201)
async def register_user(body: RegisterRequest):
    db = get_database()
    count = await db["users"].count_documents({})
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is closed. Ask an admin to create your account.",
        )
    existing = await db["users"].find_one({"username": body.username})
    if existing:
        raise HTTPException(status_code=409, detail="Username already taken")

    await db["users"].insert_one({
        "username":   body.username,
        "password":   hash_password(body.password),
        "full_name":  body.full_name,
        "role":       "admin",
        "created_at": datetime.now(timezone.utc),
    })
    logger.info("First admin created: %s", body.username)
    return {"message": f"Admin account '{body.username}' created successfully"}


# ── POST /api/auth/users  (admin creates more users) ─────────────
@router.post("/users", status_code=201)
async def create_user(body: RegisterRequest, _admin=Depends(require_permission("auth:create_user"))):
    db = get_database()
    if await db["users"].find_one({"username": body.username}):
        raise HTTPException(status_code=409, detail="Username already taken")

    await db["users"].insert_one({
        "username":   body.username,
        "password":   hash_password(body.password),
        "full_name":  body.full_name,
        "role":       body.role,
        "created_at": datetime.now(timezone.utc),
    })
    logger.info("User created: %s (role=%s)", body.username, body.role)
    return {"message": f"User '{body.username}' created with role '{body.role}'"}


# ── POST /api/auth/login ──────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    user = await db["users"].find_one({"username": form.username})
    if not user or not verify_password(form.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    logger.info("Login: %s", user["username"])
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {
            "username":  user["username"],
            "full_name": user["full_name"],
            "role":      user["role"],
        },
    }


# ── GET /api/auth/me ──────────────────────────────────────────────
@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "username":  current_user["username"],
        "full_name": current_user["full_name"],
        "role":      current_user["role"],
    }


# ── GET /api/auth/users  (admin only) ────────────────────────────
@router.get("/users")
async def list_users(_admin=Depends(require_admin)):
    db = get_database()
    users = await db["users"].find({}, {"_id": 0, "password": 0}).to_list(200)
    return {"users": users}


# ── DELETE /api/auth/users/{username}  (admin only) ──────────────
@router.delete("/users/{username}")
async def delete_user(username: str, admin=Depends(require_admin)):
    if username == admin["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db = get_database()
    result = await db["users"].delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User '{username}' deleted"}
