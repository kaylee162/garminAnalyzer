"""Write the API's OpenAPI spec to packages/api-client/openapi.json.

The web app (and the mobile app later) generate their typed API client from this file.
Run from backend/:  uv run python scripts/export_openapi.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

out = Path(__file__).resolve().parents[2] / "packages" / "api-client" / "openapi.json"
out.write_text(json.dumps(app.openapi(), indent=2) + "\n")
print(f"Wrote {out}")
