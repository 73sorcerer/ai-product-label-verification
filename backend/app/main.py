"""FastAPI entry point. Run from backend/:  uvicorn app.main:app --reload

OWNER: Amzad. STUB: routes match docs/api-contract.md. /health and /ocr work;
the rest return 501 until implemented.
"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import ocr
from app.database import init_db
from app.models import InspectionOut, OcrOut, ProductSpecIn, ProductSpecOut


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Product Label Verification API", version="0.1.0", lifespan=lifespan)

# TODO(Vincent): set CORS_ORIGINS to the deployed frontend URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr", response_model=OcrOut)
async def run_ocr(image: UploadFile = File(...)):
    """OCR only, no verification. Lets the frontend and the demo show extracted text early."""
    try:
        return ocr.extract_text(await image.read()).to_dict()
    except ocr.OcrError as e:
        raise HTTPException(422, str(e))


@app.post("/specs", response_model=ProductSpecOut, status_code=201)
def create_spec(spec: ProductSpecIn):
    raise HTTPException(501, "TODO(Amzad)")


@app.get("/specs", response_model=list[ProductSpecOut])
def list_specs():
    raise HTTPException(501, "TODO(Amzad)")


@app.get("/specs/{spec_id}", response_model=ProductSpecOut)
def get_spec(spec_id: int):
    raise HTTPException(501, "TODO(Amzad)")


@app.post("/inspections", response_model=InspectionOut, status_code=201)
async def create_inspection(spec_id: int = Form(...), image: UploadFile = File(...)):
    # TODO(Amzad): load spec -> ocr.extract_text -> verification.verify_label -> save Inspection.
    # Map ocr.OcrError to 422, as /ocr does.
    raise HTTPException(501, "TODO(Amzad)")


@app.get("/inspections", response_model=list[InspectionOut])
def list_inspections(spec_id: int | None = None):
    raise HTTPException(501, "TODO(Amzad)")


@app.get("/inspections/{inspection_id}", response_model=InspectionOut)
def get_inspection(inspection_id: int):
    raise HTTPException(501, "TODO(Amzad)")
