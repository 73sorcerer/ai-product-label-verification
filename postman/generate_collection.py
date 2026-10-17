"""Regenerates LabelGuard.postman_collection.json from data/sample_labels/ (specs.json + manifest.json).

Run after adding a sample label:  python postman/generate_collection.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "data" / "sample_labels"
MANIFEST = json.loads((SAMPLES / "manifest.json").read_text())
SPECS = json.loads((SAMPLES / "specs.json").read_text())


def js(*lines):
    return [{"listen": "test", "script": {"type": "text/javascript", "exec": list(lines)}}]


def url(path, query=None):
    raw = "{{baseUrl}}" + path
    u = {"raw": raw, "host": ["{{baseUrl}}"], "path": [p for p in path.split("?")[0].strip("/").split("/") if p]}
    if query:
        u["query"] = [{"key": k, "value": v} for k, v in query.items()]
        u["raw"] += "?" + "&".join(f"{k}={v}" for k, v in query.items())
    return u


def req(name, method, path, tests, body=None, form=None, query=None, desc=""):
    r = {"method": method, "header": [], "url": url(path, query), "description": desc}
    if body is not None:
        r["header"] = [{"key": "Content-Type", "value": "application/json"}]
        r["body"] = {"mode": "raw", "raw": json.dumps(body, indent=2), "options": {"raw": {"language": "json"}}}
    if form is not None:
        r["body"] = {"mode": "formdata", "formdata": form}
    return {"name": name, "request": r, "event": js(*tests)}


def status(code):
    return f'pm.test("status is {code}", () => pm.response.to.have.status({code}));'


def file_part(path):
    return {"key": "image", "type": "file", "src": path}


def text_part(key, value):
    return {"key": key, "type": "text", "value": value}


SPEC_SHAPE = [
    'const spec = pm.response.json();',
    'pm.test("has ProductSpec shape", () => {',
    '  pm.expect(spec).to.have.all.keys("id", "name", "fields", "created_at");',
    '  pm.expect(spec.id).to.be.a("number");',
    '  pm.expect(spec.created_at).to.match(/\\+00:00$/);  // ISO 8601 UTC',
    '});',
]
VALIDATION_422 = [status(422), 'pm.test("FastAPI validation detail", () => pm.expect(pm.response.json().detail).to.be.an("array"));']

# --- 1. health -----------------------------------------------------------------
health = req("Health check", "GET", "/health", [
    status(200),
    'pm.test("API and database are up", () => {',
    '  const b = pm.response.json();',
    '  pm.expect(b.status).to.eql("ok");',
    '  pm.expect(b.database).to.be.oneOf(["sqlite", "postgresql"]);',
    '});',
])

# --- 2. specs ------------------------------------------------------------------
specs = []
for key, spec in SPECS.items():
    specs.append(req(f"Create spec: {key}", "POST", "/specs", [
        status(201), *SPEC_SHAPE,
        f'pm.test("echoes name and fields", () => {{',
        f'  pm.expect(spec.name).to.eql({json.dumps(spec["name"])});',
        f'  pm.expect(spec.fields).to.eql({json.dumps(spec["fields"])});',
        '});',
        f'pm.collectionVariables.set("{key}_id", spec.id);',
    ], body=spec, desc=f"Creates the approved spec from data/sample_labels/specs.json and saves its id as {{{{{key}_id}}}}."))

specs += [
    req("Create spec: trims whitespace", "POST", "/specs", [
        status(201), *SPEC_SHAPE,
        'pm.test("name, keys and values are trimmed", () => {',
        '  pm.expect(spec.name).to.eql("Trim Test");',
        '  pm.expect(spec.fields).to.eql({ brand: "Sunrise Farms" });',
        '});',
    ], body={"name": "  Trim Test  ", "fields": {" brand ": "  Sunrise Farms "}}),
    req("Create spec: missing name → 422", "POST", "/specs", VALIDATION_422, body={"fields": {"brand": "X"}}),
    req("Create spec: blank name → 422", "POST", "/specs", VALIDATION_422, body={"name": "   ", "fields": {"brand": "X"}}),
    req("Create spec: name over 200 chars → 422", "POST", "/specs", VALIDATION_422, body={"name": "X" * 201, "fields": {"brand": "X"}}),
    req("Create spec: empty fields → 422", "POST", "/specs", VALIDATION_422, body={"name": "X", "fields": {}}),
    req("Create spec: blank field value → 422", "POST", "/specs", VALIDATION_422, body={"name": "X", "fields": {"brand": ""}}),
    req("Create spec: non-string value → 422", "POST", "/specs", VALIDATION_422, body={"name": "X", "fields": {"net_contents": 12}}),
    req("List specs", "GET", "/specs", [
        status(200),
        'const list = pm.response.json();',
        'pm.test("returns an array containing the seeded specs", () => {',
        '  const ids = list.map(s => s.id);',
        '  ["granola_id", "coffee_id", "vitamin_id"].forEach(v => pm.expect(ids).to.include(pm.collectionVariables.get(v)));',
        '});',
        'pm.test("oldest first (ids ascending)", () => {',
        '  const ids = list.map(s => s.id);',
        '  pm.expect(ids).to.eql([...ids].sort((a, b) => a - b));',
        '});',
    ]),
    req("Get spec by id", "GET", "/specs/{{coffee_id}}", [
        status(200), *SPEC_SHAPE,
        'pm.test("is the coffee spec", () => {',
        '  pm.expect(spec.id).to.eql(pm.collectionVariables.get("coffee_id"));',
        f'  pm.expect(spec.fields).to.eql({json.dumps(SPECS["coffee"]["fields"])});',
        '});',
    ]),
    req("Get spec: unknown id → 404", "GET", "/specs/999999999", [
        status(404), 'pm.test("says not found", () => pm.expect(pm.response.json().detail).to.include("not found"));']),
    req("Get spec: id beyond INTEGER range → 404", "GET", "/specs/99999999999", [status(404)]),
    req("Get spec: non-integer id → 422", "GET", "/specs/granola", [status(422)]),
]

# --- 3. ocr --------------------------------------------------------------------
ocr = [
    req("OCR a label", "POST", "/ocr", [
        status(200),
        'const r = pm.response.json();',
        'pm.test("has OcrResult shape", () => pm.expect(r).to.have.all.keys("text", "lines", "mean_confidence", "engine"));',
        'pm.test("reads the brand", () => pm.expect(r.text).to.include("Sunrise Farms"));',
        'pm.test("confidence is 0-1", () => pm.expect(r.mean_confidence).to.be.within(0, 1));',
    ], form=[file_part("data/sample_labels/granola_correct.png")]),
    req("OCR: non-image → 422", "POST", "/ocr", [
        status(422), 'pm.test("explains why", () => pm.expect(pm.response.json().detail).to.eql("File is not a readable image"));',
    ], form=[file_part("README.md")]),
]

# --- 4. inspections (one per sample label) ----------------------------------------
INSPECTION_KEYS = '"id", "spec_id", "image_filename", "status", "ocr", "results", "created_at"'
inspections = []
for s in MANIFEST:
    spec_key, image = s["spec_id"], s["image"]
    flags = s["expected_flags"]
    label = "pass" if s["expected_status"] == "pass" else ", ".join(f"{f} {v}" for f, v in flags.items())
    inspections.append(req(f"Inspect {image} → {label}", "POST", "/inspections", [
        status(201),
        'const insp = pm.response.json();',
        f'const expected = {json.dumps({"status": s["expected_status"], "flags": flags, "degraded": s["degraded"]})};',
        'const got = Object.fromEntries(insp.results.map(f => [f.field, f.status]));',
        f'pm.test("has Inspection shape", () => pm.expect(insp).to.have.all.keys({INSPECTION_KEYS}));',
        f'pm.test("linked to the {spec_key} spec", () => pm.expect(insp.spec_id).to.eql(pm.collectionVariables.get("{spec_key}_id")));',
        f'pm.test("records the filename", () => pm.expect(insp.image_filename).to.eql("{image}"));',
        'pm.test(`overall status is ${expected.status}`, () => pm.expect(insp.status, JSON.stringify(got)).to.eql(expected.status));',
        'Object.entries(expected.flags).forEach(([field, st]) =>',
        '  pm.test(`${field} is ${st}`, () => pm.expect(got[field], JSON.stringify(got)).to.eql(st)));',
        'if (!expected.degraded) {',
        '  pm.test("every other field matches", () => Object.entries(got).forEach(([field, st]) => {',
        '    if (!(field in expected.flags)) pm.expect(st, field).to.eql("match");',
        '  }));',
        '}',
        'pm.collectionVariables.set("last_inspection_id", insp.id);',
        f'pm.collectionVariables.set("{spec_key}_inspection_count", (Number(pm.collectionVariables.get("{spec_key}_inspection_count")) || 0) + 1);',
    ], form=[text_part("spec_id", f"{{{{{spec_key}_id}}}}"), file_part(f"data/sample_labels/{image}")],
        desc=s.get("notes", "")))

inspections += [
    req("Inspect: unknown spec → 404", "POST", "/inspections", [status(404)],
        form=[text_part("spec_id", "999999"), file_part("data/sample_labels/coffee_correct.png")]),
    req("Inspect: non-image → 422", "POST", "/inspections", [
        status(422), 'pm.test("explains why", () => pm.expect(pm.response.json().detail).to.eql("File is not a readable image"));',
    ], form=[text_part("spec_id", "{{coffee_id}}"), file_part("README.md")]),
    req("Inspect: missing image → 422", "POST", "/inspections", VALIDATION_422, form=[text_part("spec_id", "{{coffee_id}}")]),
    req("Inspect: missing spec_id → 422", "POST", "/inspections", VALIDATION_422, form=[file_part("data/sample_labels/coffee_correct.png")]),
    req("Inspect: non-integer spec_id → 422", "POST", "/inspections", VALIDATION_422,
        form=[text_part("spec_id", "coffee"), file_part("data/sample_labels/coffee_correct.png")]),
]

# --- 5. history ------------------------------------------------------------------
history = [
    req("Get inspection by id", "GET", "/inspections/{{last_inspection_id}}", [
        status(200),
        'const insp = pm.response.json();',
        'pm.test("is the last inspection created", () => pm.expect(insp.id).to.eql(pm.collectionVariables.get("last_inspection_id")));',
        'pm.test("OCR result was saved with it", () => pm.expect(insp.ocr.lines).to.be.an("array").that.is.not.empty);',
    ]),
    req("Get inspection: unknown id → 404", "GET", "/inspections/999999999", [status(404)]),
    req("Get inspection: non-integer id → 422", "GET", "/inspections/latest", [status(422)]),
    req("List inspections (newest first)", "GET", "/inspections", [
        status(200),
        'const ids = pm.response.json().map(i => i.id);',
        'pm.test("includes the last inspection", () => pm.expect(ids).to.include(pm.collectionVariables.get("last_inspection_id")));',
        'pm.test("newest first", () => pm.expect(ids).to.eql([...ids].sort((a, b) => b - a)));',
    ]),
    req("List inspections for one spec", "GET", "/inspections", [
        status(200),
        'const list = pm.response.json();',
        'const coffee = pm.collectionVariables.get("coffee_id");',
        'pm.test("only that spec\'s inspections", () => list.forEach(i => pm.expect(i.spec_id).to.eql(coffee)));',
        'pm.test("all of this run\'s coffee inspections", () =>',
        '  pm.expect(list.length).to.eql(Number(pm.collectionVariables.get("coffee_inspection_count"))));',
    ], query={"spec_id": "{{coffee_id}}"}),
    req("List inspections: unknown spec → []", "GET", "/inspections", [
        status(200), 'pm.test("empty list", () => pm.expect(pm.response.json()).to.eql([]));'], query={"spec_id": "999999999"}),
    req("List inspections: non-integer spec_id → 422", "GET", "/inspections", [status(422)], query={"spec_id": "coffee"}),
]


def folder(name, items, desc=""):
    return {"name": name, "item": items, "description": desc}


collection = {
    "info": {
        "name": "LabelGuard API",
        "description": (
            "Seeds data and tests every endpoint in docs/api-contract.md. Run the folders in order: "
            "later requests use ids saved by earlier ones.\n\n"
            "File uploads use paths relative to the repo root: set the Postman working directory "
            "(Settings → General → Working directory) to the repo, or pass `--working-dir .` to the Postman CLI.\n\n"
            "Each run adds 4 specs and 9 inspections to the database it points at. "
            "Don't run it against production in a loop."
        ),
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "variable": [
        {"key": k, "value": ""} for k in
        ["granola_id", "coffee_id", "vitamin_id", "last_inspection_id",
         "granola_inspection_count", "coffee_inspection_count", "vitamin_inspection_count"]
    ],
    "event": [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [
        '// Reset per-run counters on the first request so re-runs in the app stay accurate.',
        'if (pm.info.requestName === "Health check") {',
        '  ["granola", "coffee", "vitamin"].forEach(k => pm.collectionVariables.set(`${k}_inspection_count`, 0));',
        '}',
    ]}}],
    "item": [
        folder("1. Health", [health]),
        folder("2. Specs", specs, "Creates the three approved specs and checks validation, listing and lookup."),
        folder("3. OCR", ocr),
        folder("4. Inspections", inspections, "One inspection per sample label; expectations come from data/sample_labels/manifest.json."),
        folder("5. History", history),
    ],
}

out = ROOT / "postman" / "LabelGuard.postman_collection.json"
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps(collection, indent=2, ensure_ascii=False) + "\n")
print(out.relative_to(ROOT), sum(len(f["item"]) for f in collection["item"]), "requests")
