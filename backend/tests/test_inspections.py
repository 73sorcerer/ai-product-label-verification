"""POST /inspections, GET /inspections, GET /inspections/{id}.  OWNER: Amzad

Most tests use the `fake_ocr` fixture so they control exactly what the label "says".
The last section runs the real OCR engine on sample labels to prove the wiring end to end.
"""
import json
from datetime import datetime
from pathlib import Path

import pytest

SAMPLES = Path(__file__).resolve().parents[2] / "data" / "sample_labels"
SPEC = {
    "name": "Golden Harvest Granola",
    "fields": {
        "brand": "Sunrise Farms",
        "net_contents": "Net Wt 12 oz (340 g)",
        "allergens": "Contains: Oats, Almonds, Milk",
    },
}
GOOD_LABEL = [
    ("Sunrise Farms", 0.99),
    ("Net Wt 12 oz (340 g)", 0.98),
    ("Contains: Oats, Almonds, Milk", 0.99),
]
PNG = ("label.png", b"\x89PNG fake bytes", "image/png")


@pytest.fixture
def spec_id(client):
    return client.post("/specs", json=SPEC).json()["id"]


def inspect(client, spec_id, image=PNG):
    return client.post("/inspections", data={"spec_id": str(spec_id)}, files={"image": image})


def statuses(inspection):
    return {f["field"]: f["status"] for f in inspection["results"]}


# --- POST /inspections -------------------------------------------------------------


def test_matching_label_passes(client, spec_id, fake_ocr):
    calls = fake_ocr(GOOD_LABEL)
    r = inspect(client, spec_id)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "pass"
    assert body["spec_id"] == spec_id
    assert body["image_filename"] == "label.png"
    assert statuses(body) == {"brand": "match", "net_contents": "match", "allergens": "match"}
    assert calls == [PNG[1]]  # the uploaded bytes reached OCR unchanged


def test_response_has_full_contract_shape(client, spec_id, fake_ocr):
    fake_ocr(GOOD_LABEL)
    body = inspect(client, spec_id).json()
    assert set(body) == {"id", "spec_id", "image_filename", "status", "ocr", "results", "created_at"}
    assert set(body["ocr"]) == {"text", "lines", "mean_confidence", "engine"}
    assert body["ocr"]["text"] == "\n".join(t for t, _ in GOOD_LABEL)
    assert body["ocr"]["engine"] == "fake"
    assert body["results"][0] == {
        "field": "brand",
        "expected": "Sunrise Farms",
        "found": "Sunrise Farms",
        "status": "match",
        "confidence": 0.99,
    }
    assert datetime.fromisoformat(body["created_at"]).utcoffset().total_seconds() == 0


def test_results_follow_spec_field_order(client, spec_id, fake_ocr):
    fake_ocr(GOOD_LABEL)
    assert [f["field"] for f in inspect(client, spec_id).json()["results"]] == list(SPEC["fields"])


@pytest.mark.parametrize(
    "lines, field, expected_status",
    [
        ([("Sunrise Farms", 0.99), ("Net Wt 10 oz (283 g)", 0.98), ("Contains: Oats, Almonds, Milk", 0.99)],
         "net_contents", "incorrect"),
        ([("Sunrise Farms", 0.99), ("Net Wt 12 oz (340 g)", 0.98)],
         "allergens", "missing"),
        ([("Sunrise Farms", 0.99), ("Net Wt 12 oz (340 g)", 0.98), ("Cons Oats Almonds Mik", 0.62)],
         "allergens", "uncertain"),
    ],
    ids=["incorrect", "missing", "uncertain"],
)
def test_any_flagged_field_needs_review(client, spec_id, fake_ocr, lines, field, expected_status):
    fake_ocr(lines)
    body = inspect(client, spec_id).json()
    assert body["status"] == "needs_review"
    assert statuses(body)[field] == expected_status
    flagged = [f for f, s in statuses(body).items() if s != "match"]
    assert flagged == [field]


def test_missing_field_reports_null_found(client, spec_id, fake_ocr):
    fake_ocr(GOOD_LABEL[:2])
    allergens = inspect(client, spec_id).json()["results"][2]
    assert allergens["found"] is None
    assert allergens["confidence"] == 0.0


def test_blank_label_needs_review_with_every_field_missing(client, spec_id, fake_ocr):
    fake_ocr([])
    body = inspect(client, spec_id).json()
    assert body["status"] == "needs_review"
    assert set(statuses(body).values()) == {"missing"}


def test_unknown_spec_is_404_and_skips_ocr(client, fake_ocr):
    calls = fake_ocr(GOOD_LABEL)
    for bad_id in (999, 2**31):
        r = inspect(client, bad_id)
        assert r.status_code == 404
    assert calls == []
    assert client.get("/inspections").json() == []


def test_unreadable_image_is_422_and_not_saved(client, spec_id):
    r = inspect(client, spec_id, ("notes.txt", b"hello", "text/plain"))
    assert r.status_code == 422
    assert r.json()["detail"] == "File is not a readable image"
    assert client.get("/inspections").json() == []


def test_empty_upload_is_422(client, spec_id):
    r = inspect(client, spec_id, ("empty.png", b"", "image/png"))
    assert r.status_code == 422


@pytest.mark.parametrize(
    "data, files",
    [
        ({}, {"image": PNG}),  # no spec_id
        ({"spec_id": "abc"}, {"image": PNG}),  # spec_id not an int
        ({"spec_id": "1"}, None),  # no image
    ],
    ids=["no-spec-id", "bad-spec-id", "no-image"],
)
def test_malformed_request_is_422(client, spec_id, fake_ocr, data, files):
    fake_ocr(GOOD_LABEL)
    assert client.post("/inspections", data=data, files=files).status_code == 422


# --- GET /inspections/{id} ------------------------------------------------------


def test_get_inspection_returns_the_saved_record(client, spec_id, fake_ocr):
    fake_ocr(GOOD_LABEL)
    created = inspect(client, spec_id).json()
    r = client.get(f"/inspections/{created['id']}")
    assert r.status_code == 200
    assert r.json() == created


@pytest.mark.parametrize("inspection_id", [999, 0, 2**31])
def test_get_unknown_inspection_is_404(client, inspection_id):
    assert client.get(f"/inspections/{inspection_id}").status_code == 404


def test_get_inspection_with_non_integer_id_is_422(client):
    assert client.get("/inspections/latest").status_code == 422


# --- GET /inspections ------------------------------------------------------------


def test_list_inspections_empty(client):
    r = client.get("/inspections")
    assert r.status_code == 200
    assert r.json() == []


def test_list_inspections_newest_first(client, spec_id, fake_ocr):
    fake_ocr(GOOD_LABEL)
    ids = [inspect(client, spec_id).json()["id"] for _ in range(3)]
    assert [i["id"] for i in client.get("/inspections").json()] == ids[::-1]


def test_list_inspections_filters_by_spec(client, spec_id, fake_ocr):
    fake_ocr(GOOD_LABEL)
    other = client.post("/specs", json={"name": "Other", "fields": {"brand": "Peak Roasters"}}).json()["id"]
    mine = inspect(client, spec_id).json()["id"]
    theirs = inspect(client, other).json()["id"]

    assert [i["id"] for i in client.get("/inspections", params={"spec_id": spec_id}).json()] == [mine]
    assert [i["id"] for i in client.get("/inspections", params={"spec_id": other}).json()] == [theirs]
    assert len(client.get("/inspections").json()) == 2


@pytest.mark.parametrize("spec_filter", [999, 2**31])
def test_list_inspections_for_unknown_spec_is_empty(client, spec_id, fake_ocr, spec_filter):
    fake_ocr(GOOD_LABEL)
    inspect(client, spec_id)
    r = client.get("/inspections", params={"spec_id": spec_filter})
    assert r.status_code == 200
    assert r.json() == []


def test_list_inspections_rejects_non_integer_spec_filter(client):
    assert client.get("/inspections", params={"spec_id": "granola"}).status_code == 422


# --- real OCR engine on sample labels -------------------------------------------------

SPECS = json.loads((SAMPLES / "specs.json").read_text())


@pytest.mark.parametrize(
    "image, spec_key, expected_status, expected_flags",
    [
        ("granola_correct.png", "granola", "pass", {}),
        ("coffee_brand_typo.png", "coffee", "needs_review", {"brand": "incorrect"}),
        ("vitamin_low_quality.jpg", "vitamin", "needs_review", {"allergens": "uncertain", "best_by": "uncertain"}),
    ],
)
def test_real_label_end_to_end(client, image, spec_key, expected_status, expected_flags):
    spec_id = client.post("/specs", json=SPECS[spec_key]).json()["id"]
    mime = "image/jpeg" if image.endswith(".jpg") else "image/png"
    r = inspect(client, spec_id, (image, (SAMPLES / image).read_bytes(), mime))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == expected_status
    assert body["ocr"]["engine"] == "rapidocr"
    for field, status in expected_flags.items():
        assert statuses(body)[field] == status
