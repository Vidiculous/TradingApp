"""
Single-user JWT authentication service.
Credentials stored in .env — no user database table needed.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext

# Configuration from environment
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "CHANGE-ME-IN-PRODUCTION-use-openssl-rand-hex-32")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Single-user credentials from .env
APP_USERNAME = os.getenv("APP_USERNAME", "admin")
APP_PASSWORD_HASH = os.getenv("APP_PASSWORD_HASH", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        # If no password hash is set, auth is disabled (dev mode)
        return True
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token() -> str:
    return create_token(
        {"sub": APP_USERNAME, "type": "access"},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token() -> str:
    return create_token(
        {"sub": APP_USERNAME, "type": "refresh"},
        timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )


def authenticate_user(username: str, password: str) -> bool:
    """Verify credentials against .env values."""
    if username != APP_USERNAME:
        return False
    return verify_password(password, APP_PASSWORD_HASH)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set httpOnly secure cookies for auth tokens."""
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


def clear_auth_cookies(response: Response):
    """Clear auth cookies on logout."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


def _is_auth_enabled() -> bool:
    """Auth is enabled only when APP_PASSWORD_HASH is set in .env."""
    return bool(APP_PASSWORD_HASH)


async def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
) -> str:
    """
    FastAPI dependency that validates the JWT access token.
    If auth is not configured (no password hash), allows all requests.
    """
    if not _is_auth_enabled():
        return APP_USERNAME

    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        token_type: str = payload.get("type", "")
        if username != APP_USERNAME or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
