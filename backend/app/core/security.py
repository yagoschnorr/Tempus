import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

# Configuração do Passlib para usar o algoritmo bcrypt para hash de senhas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

# Tamanho do token cru (bytes). 32 bytes = 256 bits de entropia.
VERIFICATION_TOKEN_BYTES = 32

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha em texto plano bate com o hash criptografado."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Gera um hash criptografado a partir de uma senha em texto plano."""
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Cria um token JWT (JSON Web Token) válido para o usuário logado."""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRES_MIN)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# ---------------------------------------------------------------------------
# Tokens de verificação (troca de email, reset de senha, etc.)
# ---------------------------------------------------------------------------
# Não usamos bcrypt aqui de propósito: o token tem 256 bits de entropia, então
# SHA-256 sem salt é seguro. Salt impediria lookup direto por hash no banco.
def generate_verification_token() -> tuple[str, str]:
    """Gera um token aleatório e devolve (raw, hash). O raw vai no email
    do usuário; o hash é o que salvamos no banco.
    """
    raw = secrets.token_urlsafe(VERIFICATION_TOKEN_BYTES)
    return raw, hash_verification_token(raw)


def hash_verification_token(raw: str) -> str:
    """Hash SHA-256 hex (64 chars) — mesma função usada na geração e na validação."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
