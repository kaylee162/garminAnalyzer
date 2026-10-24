from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import activities, dashboard, health, plan, saved_plans, sync
from app.config import get_settings


def create_app() -> FastAPI:
    # On Vercel the API is served under /api. With root_path set, routes answer both with and
    # without the prefix, so local dev on http://localhost:8000/health keeps working.
    app = FastAPI(title="Garmin Analyzer API", version="0.1.0", root_path="/api")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(activities.router)
    app.include_router(dashboard.router)
    app.include_router(sync.router)
    app.include_router(plan.router)
    app.include_router(saved_plans.router)
    return app


app = create_app()
