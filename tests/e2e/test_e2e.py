"""Full user journey: spec -> upload -> verdict -> history.  OWNER: Vincent

Expectations come from data/sample_labels/manifest.json, so adding a sample adds a test.
"""
import pytest

from conftest import MANIFEST, SAMPLES, require_implemented, upload


def test_health(api):
    r = api.get("/health")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"


def test_ocr_reads_a_label(api):
    r = api.post("/ocr", files=upload(SAMPLES / "granola_correct.png"))
    assert r.status_code == 200, r.text
    assert "Sunrise Farms" in r.json()["text"]


def test_ocr_rejects_a_non_image(api):
    r = api.post("/ocr", files={"image": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 422


def test_specs_and_history_are_readable(api):
    """Read-only check that runs against production too: both lists load and have the contract shape."""
    specs = require_implemented(api.get("/specs"))
    assert specs.status_code == 200
    assert all({"id", "name", "fields"} <= s.keys() for s in specs.json())
    history = require_implemented(api.get("/inspections"))
    assert history.status_code == 200
    assert all({"id", "status", "results"} <= i.keys() for i in history.json())


def test_unknown_spec_is_404(api):
    r = require_implemented(api.get("/specs/999999999"))
    assert r.status_code == 404


@pytest.mark.parametrize("sample", MANIFEST, ids=lambda s: s["image"])
def test_inspection_verdict_matches_manifest(api, spec_ids, sample):
    r = require_implemented(api.post(
        "/inspections",
        data={"spec_id": str(spec_ids[sample["spec_id"]])},
        files=upload(SAMPLES / sample["image"]),
    ))
    assert r.status_code == 201, r.text
    inspection = r.json()
    results = {f["field"]: f["status"] for f in inspection["results"]}

    assert inspection["status"] == sample["expected_status"], results
    for field, expected in sample["expected_flags"].items():
        assert results[field] == expected, f"{field}: {results}"
    if not sample["degraded"]:  # clean photo: every un-flagged field must match exactly
        for field, status in results.items():
            if field not in sample["expected_flags"]:
                assert status == "match", f"{field}: {results}"

    # It's saved, and it shows up in history.
    saved = require_implemented(api.get(f"/inspections/{inspection['id']}"))
    assert saved.status_code == 200
    assert saved.json()["status"] == inspection["status"]
    history = require_implemented(api.get("/inspections")).json()
    assert inspection["id"] in [i["id"] for i in history]
