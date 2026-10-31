from fastapi import APIRouter, Depends
from sqlalchemy.engine import Connection

from ..database import get_db
from ..services import dashboard_service

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get("/dashboard")
def dashboard(db: Connection = Depends(get_db)):
    """KPIs + all dashboard charts in a single response."""
    return dashboard_service.get_dashboard(db)
