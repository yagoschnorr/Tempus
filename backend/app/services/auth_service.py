from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import (
    generate_verification_token,
    get_password_hash,
    hash_verification_token,
    verify_password,
)
from app.models.email_change_request import EmailChangeRequest
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services import email_service
from app.services.email_templates import email_change_verification

EMAIL_CHANGE_TOKEN_TTL = timedelta(hours=1)


def _as_utc(dt: datetime) -> datetime:
    """Normaliza datetime pra timezone-aware UTC. Postgres TIMESTAMPTZ já volta
    aware via psycopg2; SQLite (testes) volta naive — assumimos UTC porque
    nossas escritas são sempre em UTC.
    """
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

def get_user_by_email(db: Session, email: str) -> User | None:
    """Busca um usuário no banco pelo e-mail."""
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Valida as credenciais, retornando o usuário se a senha for válida."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

def register_new_user(db: Session, user_in: UserCreate) -> User:
    """Verifica se o e-mail não existe, faz o hash da senha e insere o novo usuário."""
    # Verificar se já existe um usuário com esse e-mail
    existing_user = get_user_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="O e-mail já está cadastrado em outra conta.",
        )
    
    # Criar novo objeto modelo
    new_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
    )
    
    # Salvar no banco
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

def update_user_profile(db: Session, user: User, payload: UserUpdate) -> User:
    """Atualiza nome e/ou timezone do usuário. Aplica somente os campos enviados."""
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return user

    for field, value in data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user

def change_password(
    db: Session, user: User, current_password: str, new_password: str
) -> None:
    """Troca a senha do usuário após validar a atual."""
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha atual incorreta",
        )
    # bcrypt salga o hash, então comparar via verify é o jeito correto de checar igualdade
    if verify_password(new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha precisa ser diferente da atual",
        )
    user.password_hash = get_password_hash(new_password)
    db.commit()

def delete_user_account(db: Session, user: User, password: str) -> None:
    """Exclui a conta após confirmar a senha. ON DELETE CASCADE no banco cuida
    dos dados relacionados (subjects, sessions, quizzes, documents, etc.).
    """
    if not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha incorreta",
        )
    # TODO: quando o módulo de documents tiver upload real, apagar arquivos
    # do storage antes deste delete (linhas em `documents` cascateiam, mas
    # os arquivos físicos em disco/S3 ficariam órfãos).
    db.delete(user)
    db.commit()


# ---------------------------------------------------------------------------
# Troca de email com verificação
# ---------------------------------------------------------------------------
def request_email_change(
    db: Session, user: User, new_email: str, current_password: str
) -> None:
    """Cria um pedido de troca de email e dispara o email de verificação.

    Não atualiza `users.email` agora — só após o clique no link de confirmação.
    """
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha incorreta",
        )

    normalized = new_email.lower().strip()
    if normalized == user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O novo email precisa ser diferente do atual",
        )

    # TODO(segurança): retornar 409 aqui vaza enumeração de emails cadastrados.
    # Mitigar quando tivermos rate limit + resposta de tempo constante.
    if get_user_by_email(db, normalized) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este email já está em uso por outra conta",
        )

    # Invalida pedidos pendentes anteriores do mesmo user — só um ativo por vez.
    now = datetime.now(timezone.utc)
    db.query(EmailChangeRequest).filter(
        EmailChangeRequest.user_id == user.id,
        EmailChangeRequest.used_at.is_(None),
    ).update({EmailChangeRequest.used_at: now}, synchronize_session=False)

    raw_token, token_hash = generate_verification_token()
    request = EmailChangeRequest(
        user_id=user.id,
        new_email=normalized,
        token_hash=token_hash,
        expires_at=now + EMAIL_CHANGE_TOKEN_TTL,
    )
    db.add(request)
    db.commit()

    confirm_url = f"{settings.APP_URL.rstrip('/')}/auth/email/confirm?token={raw_token}"
    subject, html, text = email_change_verification(
        name=user.name, new_email=normalized, confirm_url=confirm_url
    )
    email_service.send_email(to=normalized, subject=subject, html=html, text=text)


def confirm_email_change(db: Session, token: str) -> None:
    """Valida o token e aplica a troca de email. Idempotente: token só serve uma vez."""
    token_hash = hash_verification_token(token)
    now = datetime.now(timezone.utc)

    request = (
        db.query(EmailChangeRequest)
        .filter(
            EmailChangeRequest.token_hash == token_hash,
            EmailChangeRequest.used_at.is_(None),
        )
        .first()
    )
    if request is None or _as_utc(request.expires_at) <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido ou expirado",
        )

    # Re-checa que o email ainda não foi tomado entre o request e o confirm
    # (janela pode ser de até 1h — tempo suficiente pra alguém se cadastrar).
    conflict = get_user_by_email(db, request.new_email)
    if conflict is not None and conflict.id != request.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este email já está em uso por outra conta",
        )

    user = db.query(User).filter(User.id == request.user_id).first()
    if user is None:
        # Usuário foi deletado entre o request e o confirm. Marca como usado e bye.
        request.used_at = now
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Link inválido ou expirado",
        )

    user.email = request.new_email
    request.used_at = now
    db.commit()
