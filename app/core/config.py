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
    POLL_INTERVAL_SECONDS: float = 0.5

    # Uploads & Storage
    UPLOAD_DIR: Path = Path("uploads")
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: set[str] = {".txt", ".pdf"}

    @property
    def MAX_FILE_SIZE_BYTES(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
