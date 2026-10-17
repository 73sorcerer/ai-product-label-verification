"""API tests for /health and /ocr.  OWNER: Amzad
/specs and /inspections live in test_specs.py and test_inspections.py.
"""
from pathlib import Path

SAMPLE = Path(__file__).resolve().parents[2] / "data" / "sample_labels" / "granola_correct.png"


def test_health(client):
    from app.database import engine

    assert client.get("/health").json() == {
        "status": "ok", "database": engine.dialect.name, "commit": "local"
    }


def test_ocr_endpoint_returns_text(client):
    r = client.post("/ocr", files={"image": ("label.png", SAMPLE.read_bytes(), "image/png")})
    assert r.status_code == 200
    assert "Sunrise Farms" in r.json()["text"]


def test_ocr_endpoint_rejects_non_image(client):
    r = client.post("/ocr", files={"image": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 422
