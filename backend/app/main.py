from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import activities, health, sync
from app.config import get_settings


def create_app() -> FastAPI:
    app = FastAPI(title="Garmin Analyzer API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(activities.router)
    app.include_router(sync.router)
    return app


app = create_app()
