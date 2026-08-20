from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_token
from app.core.database import get_database
from app.core.permissions import has_permission

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    if not username:
        raise credentials_exception

    db = get_database()
    user = await db["users"].find_one({"username": username}, {"password": 0})
    if user is None:
        raise credentials_exception

    return user


def require_permission(permission: str):
    """
    Returns a FastAPI dependency that checks if the current user has the given permission.

    Usage:
        @router.post("/register")
        async def register(
            _user = Depends(require_permission("face:register_employee"))
        ):
    """
    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        role = current_user.get("role", "viewer")
        if not has_permission(role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your role '{role}' does not have permission to perform this action.",
            )
        return current_user
    return _check


# Convenience shortcuts
def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
