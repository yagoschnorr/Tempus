from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Tempus API"

    # Database
    DATABASE_URL: str

    # JWT Auth
    SECRET_KEY: str
    JWT_EXPIRES_MIN: int = 60 * 24 * 7  # 7 dias por padrão

    # OpenAI
    OPENAI_API_KEY: str

    # Email
    # "console" não envia nada — só loga. "resend" usa a API do resend.com.
    EMAIL_PROVIDER: Literal["console", "resend"] = "console"
    RESEND_API_KEY: str | None = None
    EMAIL_FROM: str = "Tempus <onboarding@resend.dev>"  # sandbox default do Resend
    EMAIL_FROM_NAME: str = "Tempus"

    # URL pública do frontend (usada em links de verificação, reset, etc.)
    APP_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
