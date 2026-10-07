from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables prefixed with GA_ (or a .env file)."""

    model_config = SettingsConfigDict(env_prefix="GA_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/garmin.db"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Garmin Connect login. Only needed for the first sync (or when saved tokens expire);
    # after that the saved tokens in garmin_token_dir are used and the password is not sent.
    garmin_email: str | None = None
    garmin_password: SecretStr | None = None
    garmin_token_dir: str = "./data/garmin_tokens"


@lru_cache
def get_settings() -> Settings:
    return Settings()
