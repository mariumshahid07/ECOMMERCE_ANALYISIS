from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..database import get_db
from ..schemas.common import Page
from ..services import seller_service

router = APIRouter(prefix="/api/sellers", tags=["Sellers"])


@router.get("", response_model=Page)
def list_sellers(
    search: Optional[str] = None,
    state: Optional[str] = None,
    sort: Optional[str] = None,
    direction: str = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Connection = Depends(get_db),
):
    return seller_service.list_sellers(db, search, state, sort, direction, page, limit)


@router.get("/{seller_id}")
def get_seller(seller_id: str, db: Connection = Depends(get_db)):
    return seller_service.get_seller(db, seller_id)
