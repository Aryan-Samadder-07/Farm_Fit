import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # ── Development / Mock mode ───────────────────────────────────────────────
    # Set MOCK_GCP_APIS=true in .env to run without real GCP credentials.
    # Defaults to True so local dev works out of the box.
    MOCK_GCP_APIS: bool = Field(default=True, alias="MOCK_GCP_APIS")

    # ── Gemini / GenAI ────────────────────────────────────────────────────────
    # The google-genai SDK naturally checks GEMINI_API_KEY.
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    GEMINI_API_KEY: str = Field(default="", alias="GEMINI_API_KEY")

    # ── Google Cloud & Firestore ──────────────────────────────────────────────
    # google-cloud-firestore checks GOOGLE_CLOUD_PROJECT or GOOGLE_APPLICATION_CREDENTIALS.
    google_cloud_project: str = Field(default="", alias="GOOGLE_CLOUD_PROJECT")
    GCP_PROJECT_ID: str = Field(default="", alias="GOOGLE_CLOUD_PROJECT")
    firestore_database: str = Field(default="(default)", alias="FIRESTORE_DATABASE")
    FIRESTORE_DATABASE: str = Field(default="(default)", alias="FIRESTORE_DATABASE")

    # ── Twilio (SMS / WhatsApp / Voice notifications) ─────────────────────────
    TWILIO_ACCOUNT_SID: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    TWILIO_FROM_NUMBER: str = Field(default="", alias="TWILIO_FROM_NUMBER")
    TWILIO_WHATSAPP_NUMBER: str = Field(default="", alias="TWILIO_WHATSAPP_NUMBER")

    # ── Weather Engine shared secret (for internal alert-push endpoint) ───────
    WEATHER_ENGINE_SECRET: str = Field(default="", alias="WEATHER_ENGINE_SECRET")

    # ── Bhashini ULCA API (alternative translation) ───────────────────────────
    BHASHINI_API_KEY: str = Field(default="", alias="BHASHINI_API_KEY")
    BHASHINI_PIPELINE_ID: str = Field(default="", alias="BHASHINI_PIPELINE_ID")

    # ── Sarvam AI API (alternative translation) ───────────────────────────────
    SARVAM_API_KEY: str = Field(default="", alias="SARVAM_API_KEY")

    # ── Authkey.io SMS/WhatsApp Gateway Configuration ─────────────────────────
    AUTHKEY_API_KEY: str = Field(default="", alias="AUTHKEY_API_KEY")
    AUTHKEY_SENDER_ID: str = Field(default="AUTHKY", alias="AUTHKEY_SENDER_ID")

    # ── Government of India data.gov.in API Key (Mandi Prices) ────────────────
    DATA_GOV_IN_API_KEY: str = Field(default="", alias="DATA_GOV_IN_API_KEY")

    # ── Free Gmail SMTP settings for email OTP sending ────────────────────────
    SMTP_HOST: str = Field(default="smtp.gmail.com", alias="SMTP_HOST")
    SMTP_PORT: int = Field(default=465, alias="SMTP_PORT")
    SMTP_USERNAME: str = Field(default="", alias="SMTP_USERNAME")
    SMTP_PASSWORD: str = Field(default="", alias="SMTP_PASSWORD")

    # ── FastAPI server ────────────────────────────────────────────────────────
    environment: str = Field(default="development", alias="ENVIRONMENT")
    port: int = Field(default=8000, alias="PORT")
    host: str = Field(default="0.0.0.0", alias="HOST")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

settings = Settings()
