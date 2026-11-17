"""Waste Before Waste API — run with:  uvicorn app.main:app --reload"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.database import SessionLocal, init_db
from app.services.assessment_service import refresh_outdated, seed_demo


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with SessionLocal() as db:
        refresh_outdated(db)  # keeps saved specifications, updates results to the current methodology
    if os.getenv("WBW_SEED_DEMO", "1") != "0":
        with SessionLocal() as db:
            seed_demo(db)
    yield


app = FastAPI(
    title="Waste Before Waste API",
    version="1.0.0",
    description=(
        "Pre-manufacturing environmental screening. All factors are illustrative and all "
        "impact figures are estimates; this is not a certified ISO 14040/14044 LCA."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("WBW_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    """Return validation problems as short, readable messages keyed by field."""
    errors = []
    for err in exc.errors():
        loc = [str(p) for p in err["loc"] if p != "body"]
        message = err["msg"].removeprefix("Value error, ")
        errors.append({"field": ".".join(loc), "message": message})
    summary = errors[0]["message"] if errors else "Invalid input."
    return JSONResponse(status_code=422, content={"detail": summary, "errors": errors})


app.include_router(router)
