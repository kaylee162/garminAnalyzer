"""Sync from the command line:  uv run python -m app.sync [--full]

Use this for the first sync: it can ask for a Garmin two-factor code, and it back-fills
your whole history, which can take a few minutes.
"""

import argparse
import logging

from app.config import get_settings
from app.db import SessionLocal
from app.sync.garmin import GarminError, connect
from app.sync.service import sync_activities


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync activities from Garmin Connect.")
    parser.add_argument("--full", action="store_true", help="re-fetch the whole history")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    try:
        source = connect(get_settings(), interactive=True)
        print("Fetching activities from Garmin...")
        with SessionLocal() as db:
            result = sync_activities(db, source, full=args.full)
    except GarminError as e:
        print(f"Sync failed: {e}")
        return 1
    print(f"Done. {result.added} new, {result.updated} updated, {result.total} in total.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
