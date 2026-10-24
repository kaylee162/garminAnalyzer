from functools import lru_cache
from typing import Annotated

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables prefixed with GA_ (or a .env file)."""

    model_config = SettingsConfigDict(env_prefix="GA_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/garmin.db"
    # Comma-separated in .env, e.g. GA_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    # Garmin Connect login. Only needed for the first sync (or when saved tokens expire);
    # after that the saved tokens in garmin_token_dir are used and the password is not sent.
    garmin_email: str | None = None
    garmin_password: SecretStr | None = None
    garmin_token_dir: str = "./data/garmin_tokens"
    # The contents of garmin_tokens.json, for hosts with no writable disk (Vercel).
    # When set it is used instead of garmin_token_dir.
    garmin_tokens: SecretStr | None = None

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Hosted Postgres (Neon, Supabase, ...) hands out postgres:// URLs; SQLAlchemy needs
        # the driver named.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value.removeprefix(prefix)
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
