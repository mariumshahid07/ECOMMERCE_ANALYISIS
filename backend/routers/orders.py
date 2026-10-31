from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..database import get_db
from ..schemas.common import OrderPage
from ..services import order_service

router = APIRouter(prefix="/api/orders", tags=["Orders"])


@router.get("", response_model=OrderPage)
def list_orders(
    order_id: Optional[str] = Query(None, description="search by order id"),
    customer_id: Optional[str] = Query(None, description="search by customer id"),
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    sort: Optional[str] = None,
    direction: str = "desc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Connection = Depends(get_db),
):
    return order_service.list_orders(db, order_id, customer_id, status, date_from, date_to,
                                     sort, direction, page, limit)


@router.get("/{order_id}")
def get_order(order_id: str, db: Connection = Depends(get_db)):
    return order_service.get_order(db, order_id)
