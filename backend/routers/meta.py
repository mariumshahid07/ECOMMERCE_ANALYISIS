"""routers/meta.py - health check + dropdown values."""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.engine import Connection

from ..database import get_db
from ..services import meta_service
from ..utils.db_helpers import fetch_scalar

router = APIRouter(prefix="/api", tags=["Meta"])


@router.get("/health")
def health(db: Connection = Depends(get_db)):
    """The top-bar badge calls this to show 'Database connected'."""
    return {"status": "ok", "orders": fetch_scalar(db, "SELECT COUNT(*) FROM orders")}


@router.get("/filters")
def filters(db: Connection = Depends(get_db)):
    return meta_service.get_filter_options(db)


@router.get("/cities")
def cities(state: Optional[str] = None, db: Connection = Depends(get_db)):
    return meta_service.get_cities(db, state)
