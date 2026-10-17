"""End-to-end tests run against a live server over HTTP.  OWNER: Vincent

    E2E_BASE_URL=http://localhost:8000 pytest tests/e2e          # local uvicorn (default)
    E2E_BASE_URL=https://<app>.vercel.app/api pytest tests/e2e   # deployed
    E2E_READONLY=1 ...                                           # skip tests that create data

Production runs use E2E_READONLY=1 (deploy-check.yml) so every merge doesn't add duplicate
specs and test inspections to the live database the demo uses.
"""
import json
import os
from pathlib import Path

import httpx
import pytest

SAMPLES = Path(__file__).resolve().parents[2] / "data" / "sample_labels"
MANIFEST = json.loads((SAMPLES / "manifest.json").read_text())
SPECS = json.loads((SAMPLES / "specs.json").read_text())
READONLY = os.getenv("E2E_READONLY") == "1"


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
    """Routes that are still stubs return 501.

    Default: xfail, so required CI stays green while features are in progress.
    E2E_STRICT=1: fail instead, so "MVP completeness" honestly shows what's still missing.
    """
    if response.status_code == 501:
        msg = f"{response.request.method} {response.request.url.path} not implemented yet"
        if os.getenv("E2E_STRICT") == "1":
            pytest.fail(msg, pytrace=False)
        pytest.xfail(msg)
    return response


@pytest.fixture(scope="session")
def spec_ids(api):
    """Create each approved spec once per run; returns {"granola": 12, ...}."""
    if READONLY:
        pytest.skip("E2E_READONLY=1: this test creates specs and inspections")
    ids = {}
    for key, spec in SPECS.items():
        r = require_implemented(api.post("/specs", json=spec))
        assert r.status_code == 201, r.text
        ids[key] = r.json()["id"]
    return ids


def upload(path: Path) -> dict:
    mime = "image/jpeg" if path.suffix == ".jpg" else "image/png"
    return {"image": (path.name, path.read_bytes(), mime)}
