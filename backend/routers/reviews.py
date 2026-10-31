from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..database import get_db
from ..services import review_service

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


@router.get("")
def reviews(
    score: Optional[int] = Query(None, ge=1, le=5),
    order_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    sort: Optional[str] = None,
    direction: str = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Connection = Depends(get_db),
):
    return review_service.get_reviews(db, score, order_id, date_from, date_to, sort, direction, page, limit)
