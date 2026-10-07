# Garmin Analyzer

A personal app that syncs runs from Garmin Connect, shows which running metrics are improving over time, and builds training plans from your own numbers. No AI inside: every number comes from a written-down formula.

## Layout

```
backend/                 Python API (FastAPI), Garmin sync and analytics
  app/api/               HTTP routes
  app/models/            Database tables (SQLAlchemy)
  app/sync/              All Garmin Connect calls live here
  app/analytics/         Pure calculation functions (trends, load, planner math)
  alembic/               Database migrations
web/                     Web app (React + TypeScript + Vite + Tailwind)
packages/api-client/     Typed API client generated from the backend's OpenAPI spec,
                         shared by the web app and the mobile app later
```

The backend is a plain JSON API, so the web app (and an Expo mobile app later) are just clients of it. Every table will carry a `user_id`, so the app is single-user today but can support more people later.

## Requirements

- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Node 20+ and npm

## Run it locally

Backend (http://localhost:8000, API docs at http://localhost:8000/docs):

```sh
cd backend
uv sync
uv run alembic upgrade head      # creates backend/data/garmin.db
uv run uvicorn app.main:app --reload
```

Web app (http://localhost:5173), in a second terminal from the repo root:

```sh
npm install
npm run dev:web
```

The home page shows whether the web app can reach the API and database, a **Sync now** button, and your recent runs.

## Connect Garmin

Your Garmin login stays on your computer. It goes in `backend/.env`, which git ignores.

1. Copy the example settings file and fill in your Garmin Connect email and password.

   Windows PowerShell:
   ```powershell
   cd backend
   Copy-Item .env.example .env
   notepad .env
   ```
   macOS / Linux: `cp .env.example .env` and edit it.

2. Run the first sync from a terminal. It back-fills your whole history (this can take a few minutes) and asks for a two-factor code if your Garmin account uses one:
   ```sh
   uv run alembic upgrade head
   uv run python -m app.sync
   ```

After the first login the app saves login tokens in `backend/data/garmin_tokens/` and reuses them, so you can remove the password from `.env` if you like. From then on the **Sync now** button in the web app fetches new activities. `uv run python -m app.sync --full` re-fetches everything.

The sync uses the unofficial [garminconnect](https://github.com/cyberjunky/python-garminconnect) library. If Garmin changes its login, only `backend/app/sync/garmin.py` needs to change.

## Common tasks

| Task | Command |
|---|---|
| Sync from Garmin | `cd backend && uv run python -m app.sync` |
| Backend tests | `cd backend && uv run pytest` |
| Lint / format Python | `cd backend && uv run ruff check . && uv run ruff format .` |
| New migration after changing models | `cd backend && uv run alembic revision --autogenerate -m "what changed"` |
| Regenerate the API client after changing routes | `npm run api:generate` (from the repo root) |

Settings are read from environment variables prefixed with `GA_` (see `backend/.env.example`) and `VITE_API_URL` for the web app (see `web/.env.example`).
