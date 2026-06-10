"""
Environment-driven application settings via pydantic-settings.
All values are read from environment variables or a .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central config object.  Add every env var here — never read
    os.environ directly anywhere else in the codebase.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "AkuMart API"
    DEBUG: bool = False

    # Database (Supabase / PostgreSQL)
    DATABASE_URL: str  # asyncpg DSN: postgresql+asyncpg://...

    # JWT
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Misc
    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()
