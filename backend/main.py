"""
main.py - the entry point. Start the app with:

    uvicorn backend.main:app --reload

It creates the FastAPI app, registers every router (group of API URLs),
adds friendly error handlers, and serves the frontend files.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from .config import BASE_DIR, settings
from .database import engine
from .models.tables import metadata
from .routers import analytics, customers, dashboard, meta, orders, payments, products, reviews, sellers

log = logging.getLogger("olist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once when the server starts: print a clear message if MySQL / a table is missing."""
    try:
        existing = set(inspect(engine).get_table_names())
        missing = set(metadata.tables) - existing
        if missing:
            log.warning("Database '%s' is missing tables: %s", settings.DB_NAME, ", ".join(sorted(missing)))
        else:
            log.warning("Connected to MySQL database '%s' - all %d tables found.", settings.DB_NAME, len(existing))
    except SQLAlchemyError as exc:
        log.warning("Could not connect to MySQL at start-up: %s", exc.__cause__ or exc)
    yield


app = FastAPI(title="Olist E-Commerce Analytics", version="1.0.0",
              description="REST API for the olist_ecommerce MySQL database. Try it at /docs",
              lifespan=lifespan)

# ---- API routes ----
for module in (meta, dashboard, orders, customers, products, sellers, payments, reviews, analytics):
    app.include_router(module.router)


# ---- error handling: always answer with JSON {"detail": "..."} ----
@app.exception_handler(RequestValidationError)
async def bad_request(request: Request, exc: RequestValidationError):
    """Invalid query parameters -> 400 (FastAPI's default is 422)."""
    msg = "; ".join(f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
    return JSONResponse(status_code=400, content={"detail": f"Bad request - {msg}"})


@app.exception_handler(OperationalError)
async def db_unreachable(request: Request, exc: OperationalError):
    log.error("Database connection problem: %s", exc)
    return JSONResponse(status_code=500, content={
        "detail": "Cannot connect to MySQL. Check that MySQL is running and the .env settings are correct."})


@app.exception_handler(SQLAlchemyError)
async def db_error(request: Request, exc: SQLAlchemyError):
    log.error("Database error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "A database error occurred. See the server console."})


# ---- frontend (plain HTML/CSS/JS files in /frontend) ----
FRONTEND = BASE_DIR / "frontend"
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(Path(FRONTEND) / "index.html")
