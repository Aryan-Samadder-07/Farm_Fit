import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # Gemini Configuration
    # The google-genai SDK naturally checks GEMINI_API_KEY. We expose it here for explicit verification.
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")

    # Google Cloud & Firestore Configuration
    # google-cloud-firestore naturally checks GOOGLE_CLOUD_PROJECT or GOOGLE_APPLICATION_CREDENTIALS.
    google_cloud_project: str = Field(default="", alias="GOOGLE_CLOUD_PROJECT")
    firestore_database: str = Field(default="(default)", alias="FIRESTORE_DATABASE")

    # FastAPI settings
    environment: str = Field(default="development", alias="ENVIRONMENT")
    port: int = Field(default=8000, alias="PORT")
    host: str = Field(default="0.0.0.0", alias="HOST")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
