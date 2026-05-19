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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
