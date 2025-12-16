from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    MONGO_URL: str
    DB_NAME: str
    CORS_ORIGINS: str = "*"
    CEREBRAS_API_KEY: str
    MAPPLES_API_KEY: str
    JWT_SECRET_KEY: str = "ayumitra-secret-key-change-in-production-2025"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 10080
    
    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings():
    return Settings()