from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.engine import Connection

from ..database import get_db
from ..schemas.common import Page
from ..services import product_service

router = APIRouter(prefix="/api", tags=["Products & Categories"])


@router.get("/products", response_model=Page)
def list_products(
    search: Optional[str] = None,
    category: Optional[str] = Query(None, description="Portuguese category name"),
    sort: Optional[str] = None,
    direction: str = "asc",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Connection = Depends(get_db),
):
    return product_service.list_products(db, search, category, sort, direction, page, limit)


@router.get("/products/{product_id}")
def get_product(product_id: str, db: Connection = Depends(get_db)):
    return product_service.get_product(db, product_id)


@router.get("/categories")
def categories(search: Optional[str] = None, db: Connection = Depends(get_db)):
    return product_service.list_categories(db, search)
