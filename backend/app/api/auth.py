from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

from app.db.database import get_db
from app.db import models
from app.core import security
from app.api.deps import get_current_user

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    facility_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/auth/login", response_model=TokenResponse)
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    User authentication endpoint.
    Accepts both JSON payload ({ "email": "...", "password": "..." }) and OAuth2 Form data.
    Returns JWT access_token and user session metadata.
    """
    email: Optional[str] = None
    password: Optional[str] = None

    # Try parsing JSON body first
    try:
        body = await request.json()
        if isinstance(body, dict):
            email = body.get("email") or body.get("username")
            password = body.get("password")
    except Exception:
        pass

    # Fallback to Form Data parsing if JSON body not provided
    if not email or not password:
        try:
            form = await request.form()
            email = form.get("username") or form.get("email")
            password = form.get("password")
        except Exception:
            pass

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing email or password credentials"
        )

    # Database User Lookup
    user = db.query(models.User).filter(models.User.email == email.strip()).first()
    if not user or not security.verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate JWT Token
    access_token = security.create_access_token(
        data={
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "facility_id": user.facility_id
        }
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.from_orm(user)
    )


@router.get("/auth/me", response_model=UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    """
    Protected session profile endpoint. Returns details of authenticated active user.
    """
    return UserOut.from_orm(current_user)
