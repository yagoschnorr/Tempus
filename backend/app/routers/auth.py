from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.core.deps import get_current_user
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate
from app.schemas.auth import (
    AccountDelete,
    AuthResponse,
    EmailChangeConfirm,
    EmailChangeRequest,
    PasswordChange,
)
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

@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_current_user_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Troca a senha do usuário logado. Requer a senha atual pra confirmar."""
    auth_service.change_password(
        db, current_user, payload.current_password, payload.new_password
    )

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_current_user(
    payload: AccountDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exclui permanentemente a conta logada. Cascade do banco apaga dados relacionados."""
    auth_service.delete_user_account(db, current_user, payload.password)

@router.post("/me/email/change-request", status_code=status.HTTP_204_NO_CONTENT)
def request_email_change(
    payload: EmailChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Inicia troca de email: valida senha, gera token e envia email de verificação
    pro novo endereço. A troca só efetiva quando o usuário clicar no link.
    """
    auth_service.request_email_change(
        db, current_user, payload.new_email, payload.current_password
    )

@router.post("/email/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_email_change(
    payload: EmailChangeConfirm,
    db: Session = Depends(get_db),
):
    """Confirma a troca de email a partir do token enviado por email. Rota pública
    (não exige JWT) — o token é a prova de posse do novo endereço.
    """
    auth_service.confirm_email_change(db, payload.token)
