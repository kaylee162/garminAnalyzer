"""The only place that calls the garminconnect library."""

import logging
from pathlib import Path
from typing import Any, Protocol

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

from app.config import Settings

log = logging.getLogger(__name__)


class GarminError(Exception):
    """Login or fetch failed. The message is safe to show to the user."""


class GarminSource(Protocol):
    """What the sync needs from Garmin. Tests pass a fake that implements this."""

    def display_name(self) -> str | None: ...

    def activities_page(self, start: int, limit: int) -> list[dict[str, Any]]:
        """Activities newest first; start is the offset (0 = most recent)."""
        ...


class GarminConnectSource:
    def __init__(self, client: Garmin) -> None:
        self._client = client

    def display_name(self) -> str | None:
        return self._client.get_full_name()

    def activities_page(self, start: int, limit: int) -> list[dict[str, Any]]:
        try:
            page = self._client.get_activities(start, limit)
        except GarminConnectTooManyRequestsError as e:
            raise GarminError("Garmin is rate limiting requests. Try again in a while.") from e
        except GarminConnectConnectionError as e:
            raise GarminError(f"Could not fetch activities from Garmin: {e}") from e
        return page if isinstance(page, list) else []


def has_saved_tokens(settings: Settings) -> bool:
    return (Path(settings.garmin_token_dir) / "garmin_tokens.json").exists()


def _password(settings: Settings) -> str | None:
    return settings.garmin_password.get_secret_value() if settings.garmin_password else None


def is_configured(settings: Settings) -> bool:
    """True when a sync can log in: saved tokens, or an email and password in .env."""
    return has_saved_tokens(settings) or bool(settings.garmin_email and _password(settings))


def connect(settings: Settings, *, interactive: bool = False) -> GarminConnectSource:
    """Log in with saved tokens, falling back to the email and password from .env.

    interactive=True asks for an MFA code in the terminal if Garmin wants one. The API never
    prompts, so an account with MFA must log in once from the command line first.
    """
    if not is_configured(settings):
        raise GarminError(
            "Not connected to Garmin yet. Add GA_GARMIN_EMAIL and GA_GARMIN_PASSWORD to "
            "backend/.env, then run the first sync: uv run python -m app.sync"
        )

    client = Garmin(
        settings.garmin_email or None,
        _password(settings) or None,
        prompt_mfa=(lambda: input("Garmin MFA code: ").strip()) if interactive else None,
    )
    Path(settings.garmin_token_dir).mkdir(parents=True, exist_ok=True)
    try:
        client.login(settings.garmin_token_dir)
    except GarminConnectAuthenticationError as e:
        if "MFA" in str(e):
            raise GarminError(
                "Garmin asked for a two-factor code. Run the first sync from a terminal so "
                "you can type it: uv run python -m app.sync"
            ) from e
        raise GarminError(f"Garmin login failed: {e}") from e
    except GarminConnectTooManyRequestsError as e:
        raise GarminError("Too many Garmin login attempts. Wait a few minutes.") from e
    except GarminConnectConnectionError as e:
        raise GarminError(f"Could not reach Garmin: {e}") from e
    log.info("Logged in to Garmin Connect")
    return GarminConnectSource(client)
