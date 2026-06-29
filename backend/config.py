from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Get the backend directory
BACKEND_DIR = Path(__file__).parent

class Settings(BaseSettings):
    MONGO_URL: str
    DB_NAME: str
    CORS_ORIGINS: str = "http://localhost:3000"
    GOOGLE_GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""  # For the new google-genai library
    MAPPLES_API_KEY: str = ""
    CEREBRAS_API_KEY: str = ""
    JWT_SECRET_KEY: str  # Required: must be set via environment, no insecure default
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 10080
    LANGSMITH_API_KEY: str = ""
    LANGSMITH_PROJECT: str = "ayumitra-ai"
    LANGSMITH_TRACING: str = "true"  # For the new pattern
    LANGCHAIN_TRACING_V2: str = "true"
    LANGSMITH_ENDPOINT: str = "https://api.smith.langchain.com"
    FIRECRAWL_API_KEY: str = ""
    QDRANT_URL: str = ""
    QDRANT_API_KEY: str = ""
    
    class Config:
        env_file = str(BACKEND_DIR / ".env")
        case_sensitive = True
        extra = "ignore"

@lru_cache()
def get_settings():
    return Settings()