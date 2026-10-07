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

The home page shows whether the web app can reach the API and database.

## Common tasks

| Task | Command |
|---|---|
| Backend tests | `cd backend && uv run pytest` |
| Lint / format Python | `cd backend && uv run ruff check . && uv run ruff format .` |
| New migration after changing models | `cd backend && uv run alembic revision --autogenerate -m "what changed"` |
| Regenerate the API client after changing routes | `npm run api:generate` (from the repo root) |

Settings are read from environment variables prefixed with `GA_` (see `backend/.env.example`) and `VITE_API_URL` for the web app (see `web/.env.example`).
