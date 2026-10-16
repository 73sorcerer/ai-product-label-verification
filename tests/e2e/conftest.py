"""End-to-end tests run against a live server over HTTP.  OWNER: Vincent

    E2E_BASE_URL=http://localhost:8000 pytest tests/e2e          # local uvicorn (default)
    E2E_BASE_URL=https://<app>.vercel.app/api pytest tests/e2e   # deployed
"""
import json
import os
from pathlib import Path

import httpx
import pytest

SAMPLES = Path(__file__).resolve().parents[2] / "data" / "sample_labels"
MANIFEST = json.loads((SAMPLES / "manifest.json").read_text())
SPECS = json.loads((SAMPLES / "specs.json").read_text())


@pytest.fixture(scope="session")
def api():
    base = os.getenv("E2E_BASE_URL", "http://localhost:8000").rstrip("/")
    headers = {}
    if secret := os.getenv("VERCEL_AUTOMATION_BYPASS_SECRET"):  # for protected preview deployments
        headers["x-vercel-protection-bypass"] = secret
    # 60 s: the first OCR call after a cold start loads the models.
    with httpx.Client(base_url=base, headers=headers, timeout=60) as client:
        yield client


def require_implemented(response: httpx.Response) -> httpx.Response:
    """Routes that are still stubs return 501. Mark the test xfail so CI stays green until they land."""
    if response.status_code == 501:
        pytest.xfail(f"{response.request.method} {response.request.url.path} not implemented yet")
    return response


@pytest.fixture(scope="session")
def spec_ids(api):
    """Create each approved spec once per run; returns {"granola": 12, ...}."""
    ids = {}
    for key, spec in SPECS.items():
        r = require_implemented(api.post("/specs", json=spec))
        assert r.status_code == 201, r.text
        ids[key] = r.json()["id"]
    return ids


def upload(path: Path) -> dict:
    mime = "image/jpeg" if path.suffix == ".jpg" else "image/png"
    return {"image": (path.name, path.read_bytes(), mime)}
