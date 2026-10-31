from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..database import get_db
from ..schemas.common import Page
from ..services import customer_service

router = APIRouter(prefix="/api/customers", tags=["Customers"])


@router.get("", response_model=Page)
def list_customers(
    search: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    sort: Optional[str] = None,
    direction: str = "asc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Connection = Depends(get_db),
):
    return customer_service.list_customers(db, search, state, city, sort, direction, page, limit)


@router.get("/{customer_id}")
def get_customer(customer_id: str, db: Connection = Depends(get_db)):
    return customer_service.get_customer(db, customer_id)
