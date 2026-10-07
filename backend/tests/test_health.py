from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_ok():
    response = TestClient(app).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok", "version": "0.1.0"}


def test_cors_origins_read_as_comma_separated_list(monkeypatch):
    from app.config import Settings

    monkeypatch.setenv("GA_CORS_ORIGINS", "http://localhost:5173, http://127.0.0.1:5173")

    assert Settings().cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]
