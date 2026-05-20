from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.core.deps import get_current_user
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate
from app.schemas.auth import AuthResponse
from app.services import auth_service
from app.models.user import User

router = APIRouter()

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Rota para registrar um novo usuário."""
    user = auth_service.register_new_user(db, user_in)
    access_token = create_access_token(subject=user.id)
    return {"user": user, "access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=AuthResponse)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    """Rota para fazer login. Retorna o usuário e o token JWT."""
    user = auth_service.authenticate_user(db, email=user_in.email, password=user_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(subject=user.id)
    return {"user": user, "access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Retorna os dados do usuário atualmente logado (requer token válido)."""
    return current_user

@router.patch("/me", response_model=UserResponse)
def update_current_user(
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atualiza nome e/ou timezone do usuário logado (PATCH parcial)."""
    return auth_service.update_user_profile(db, current_user, payload)
