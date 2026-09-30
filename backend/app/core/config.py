import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Crisis Command"
    ENV: str = "development"
    DEMO_MODE: bool = True

    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # JWT Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "default_crisis_command_jwt_secret_dev")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # AI Configuration
    AI_PRIMARY_PROVIDER: str = "gemini"
    AI_FALLBACK_PROVIDER: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = ""
    GEMINI_MODEL: Optional[str] = "gemini-1.5-flash"
    OPENAI_API_KEY: Optional[str] = ""
    OPENAI_MODEL: Optional[str] = ""
    ANTHROPIC_API_KEY: Optional[str] = ""
    ANTHROPIC_MODEL: Optional[str] = ""

    # SMTP Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = ""
    SMTP_PASSWORD: Optional[str] = ""
    SMTP_FROM_EMAIL: str = "noreply@crisiscommand.org"
    SMTP_FROM_NAME: str = "Crisis Command"
    SMTP_USE_TLS: bool = True

    # Firebase
    FIREBASE_PROJECT_ID: Optional[str] = ""
    FIREBASE_CLIENT_EMAIL: Optional[str] = ""
    FIREBASE_PRIVATE_KEY: Optional[str] = ""

    # OpenStreetMap, Geocoding & Routing (No Google Maps)
    MAP_PROVIDER: str = "openstreetmap"
    MAP_TILE_PROVIDER: str = "openstreetmap"
    GEOCODING_PROVIDER: str = "nominatim"
    ROUTING_PROVIDER: str = "osrm"
    LOCATION_DETECTION_ENABLED: bool = True

    # Native Sharing
    UNIVERSAL_WEB_SHARE_ENABLED: bool = True
    CLIPBOARD_SHARE_ENABLED: bool = True
    INCIDENT_SHARE_ENABLED: bool = True

    # CORS / Endpoints
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
