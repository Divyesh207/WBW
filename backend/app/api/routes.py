"""HTTP API. Interactive documentation is served at /docs."""
from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.assessment import Assessment
from app.schemas.product import OptimizeRequest, ProductSpec
from app.services import assessment_service
from app.services.assessment_engine import DISCLAIMER
from app.services.demo_data import DEMO_SCENARIOS
from app.services.factors import UnknownFactorError, get_factors
from app.services.landing_lab import build_lab
from app.services.report_generator import build_pdf

router = APIRouter(prefix="/api")


def _get_or_404(db: Session, assessment_id: int) -> Assessment:
    row = db.get(Assessment, assessment_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Assessment not found.")
    return row


def _filename(row: Assessment, ext: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", row.name.lower()).strip("-") or "assessment"
    return f"wbw-{slug}-{row.id}.{ext}"


@router.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": "Waste Before Waste API", "disclaimer": DISCLAIMER}


@router.get("/reference", tags=["reference"], summary="Factor datasets and form options")
def reference():
    return get_factors().reference()


@router.get("/demo-scenarios", tags=["reference"], summary="Pre-configured demo specifications")
def demo_scenarios():
    return [{"key": s["key"], "summary": s["summary"], "spec": s["spec"]} for s in DEMO_SCENARIOS]


@router.get("/lab", tags=["reference"], summary="Engine results for the landing-page material lab")
def lab():
    return build_lab()


@router.post("/demo/reset", tags=["system"], summary="Delete all assessments and restore demo data")
def reset_demo(db: Session = Depends(get_db)):
    return {"seeded": assessment_service.seed_demo(db, force=True)}


@router.get("/dashboard", tags=["dashboard"])
def dashboard(db: Session = Depends(get_db)):
    return assessment_service.dashboard(db)


@router.post("/assessments/preview", tags=["assessments"], summary="Calculate without saving")
def preview(spec: ProductSpec):
    try:
        return assessment_service.run_pipeline(spec)
    except UnknownFactorError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/assessments", tags=["assessments"], status_code=201, summary="Run and save an assessment")
def create(spec: ProductSpec, db: Session = Depends(get_db)):
    try:
        return assessment_service.create_assessment(db, spec).to_dict()
    except UnknownFactorError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/assessments", tags=["assessments"], summary="List saved assessments")
def list_assessments(db: Session = Depends(get_db)):
    rows = db.scalars(select(Assessment).order_by(Assessment.created_at.desc())).all()
    return [r.summary() for r in rows]


@router.get("/assessments/{assessment_id}", tags=["assessments"])
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, assessment_id).to_dict()


@router.delete("/assessments/{assessment_id}", tags=["assessments"], status_code=204)
def delete_assessment(assessment_id: int, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, assessment_id))
    db.commit()
    return Response(status_code=204)


@router.post(
    "/assessments/{assessment_id}/optimize",
    tags=["comparison"],
    summary="Apply the selected recommendations and recalculate",
)
def optimize(assessment_id: int, body: OptimizeRequest, db: Session = Depends(get_db)):
    row = _get_or_404(db, assessment_id)
    return assessment_service.reoptimize(db, row, body.recommendation_ids).to_dict()


@router.get("/assessments/{assessment_id}/report.pdf", tags=["reports"])
def report_pdf(assessment_id: int, db: Session = Depends(get_db)):
    row = _get_or_404(db, assessment_id)
    pdf = build_pdf(row.to_dict(), get_factors().reference())
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_filename(row, "pdf")}"'},
    )


@router.get("/assessments/{assessment_id}/export.json", tags=["reports"])
def export_json(assessment_id: int, db: Session = Depends(get_db)):
    row = _get_or_404(db, assessment_id)
    payload = {"generator": "Waste Before Waste", "disclaimer": DISCLAIMER, **row.to_dict()}
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{_filename(row, "json")}"'},
    )
