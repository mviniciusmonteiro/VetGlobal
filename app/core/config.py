from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "VetGlobal"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database (injected via .env or environment variables)
    DATABASE_URL: str

    # Polling
    POLL_TIMEOUT_SECONDS: int = 25
    POLL_INTERVAL_SECONDS: float = 1.0

    # Uploads
    UPLOAD_DIR: Path = Path("uploads")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
