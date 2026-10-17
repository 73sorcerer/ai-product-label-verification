"""FastAPI entry point. Run from backend/:  uvicorn app.main:app --reload

OWNER: Amzad. Routes match docs/api-contract.md.
"""
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app import ocr, verification
from app.database import engine, get_db, init_db
from app.models import (
    Inspection,
    InspectionOut,
    OcrOut,
    ProductSpec,
    ProductSpecIn,
    ProductSpecOut,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


# On Vercel the API is served under /api (see vercel.json). root_path makes /api/docs load the right schema URL.
app = FastAPI(
    title="Product Label Verification API",
    version="0.1.0",
    lifespan=lifespan,
    root_path="/api" if os.getenv("VERCEL") else "",
)

# TODO(Vincent): set CORS_ORIGINS to the deployed frontend URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Liveness + database check. Used by CI smoke tests and the demo warm-up (docs/deployment.md)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db = engine.dialect.name  # "sqlite" locally, "postgresql" when deployed
    except Exception:
        raise HTTPException(503, "database unreachable")
    return {"status": "ok", "database": db}


@app.post("/ocr", response_model=OcrOut)
async def run_ocr(image: UploadFile = File(...)):
    """OCR only, no verification. Lets the frontend and the demo show extracted text early."""
    try:
        return ocr.extract_text(await image.read()).to_dict()
    except ocr.OcrError as e:
        raise HTTPException(422, str(e))


@app.post("/specs", response_model=ProductSpecOut, status_code=201)
def create_spec(spec: ProductSpecIn, db: Session = Depends(get_db)):
    row = ProductSpec(name=spec.name, fields=spec.fields)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/specs", response_model=list[ProductSpecOut])
def list_specs(db: Session = Depends(get_db)):
    return db.scalars(select(ProductSpec).order_by(ProductSpec.id)).all()


@app.get("/specs/{spec_id}", response_model=ProductSpecOut)
def get_spec(spec_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, ProductSpec, spec_id)


@app.post("/inspections", response_model=InspectionOut, status_code=201)
async def create_inspection(
    spec_id: int = Form(...), image: UploadFile = File(...), db: Session = Depends(get_db)
):
    """Load spec -> OCR -> verify -> save. The spec is checked first so a bad id never costs an OCR run."""
    spec = _get_or_404(db, ProductSpec, spec_id)
    data = await image.read()
    try:
        # OCR is CPU-bound (~1-2 s); keep it off the event loop.
        result = await run_in_threadpool(ocr.extract_text, data)
    except ocr.OcrError as e:
        raise HTTPException(422, str(e))
    verdict = verification.verify_label(result, spec.fields)

    row = Inspection(
        spec_id=spec.id,
        image_filename=(image.filename or "upload")[:255],
        status=verdict.status,
        ocr=result.to_dict(),
        results=[f.to_dict() for f in verdict.fields],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.get("/inspections", response_model=list[InspectionOut])
def list_inspections(spec_id: int | None = None, db: Session = Depends(get_db)):
    """History, newest first. An unknown spec_id returns an empty list, not 404."""
    query = select(Inspection).order_by(Inspection.created_at.desc(), Inspection.id.desc())
    if spec_id is not None:
        if not _valid_id(spec_id):
            return []
        query = query.where(Inspection.spec_id == spec_id)
    return db.scalars(query).all()


@app.get("/inspections/{inspection_id}", response_model=InspectionOut)
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Inspection, inspection_id)


MAX_ID = 2**31 - 1  # Postgres INTEGER; a bigger id would raise instead of simply not existing


def _valid_id(row_id: int) -> bool:
    return 1 <= row_id <= MAX_ID


def _get_or_404(db: Session, model, row_id: int):
    row = db.get(model, row_id) if _valid_id(row_id) else None
    if row is None:
        raise HTTPException(404, f"{model.__name__} {row_id} not found")
    return row
