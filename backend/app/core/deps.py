from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.core.security import ALGORITHM

# Esquema do OAuth2: avisa ao FastAPI/Swagger onde buscar o token (no header Authorization: Bearer ...)
# Passaremos a URL de login caso o Swagger precise autenticar lá (no caso, a rota que criaremos será /api/auth/login)
reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"/api/auth/login"
)

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    """
    Dependência central de segurança.
    Intercepta o Token JWT da requisição, decodifica, busca no banco e devolve o modelo User.
    Se o token for inválido, expirado ou usuário não existir, lança erro 401 ou 403 HTTP.
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token não contém a identificação do usuário",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Não foi possível validar as credenciais",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado",
        )
    
    return user
