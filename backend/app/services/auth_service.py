from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password

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
