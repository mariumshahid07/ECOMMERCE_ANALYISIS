from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.engine import Connection

from ..database import get_db
from ..services import analytics_service as svc

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/sales")
def sales(date_from: Optional[date] = None, date_to: Optional[date] = None, db: Connection = Depends(get_db)):
    return svc.sales(db, date_from, date_to)


@router.get("/orders")
def orders(date_from: Optional[date] = None, date_to: Optional[date] = None, db: Connection = Depends(get_db)):
    return svc.orders(db, date_from, date_to)


@router.get("/customers")
def customers(date_from: Optional[date] = None, date_to: Optional[date] = None, db: Connection = Depends(get_db)):
    return svc.customers(db, date_from, date_to)


@router.get("/products")
def products(date_from: Optional[date] = None, date_to: Optional[date] = None, db: Connection = Depends(get_db)):
    return svc.products(db, date_from, date_to)


@router.get("/sellers")
def sellers(date_from: Optional[date] = None, date_to: Optional[date] = None, db: Connection = Depends(get_db)):
    return svc.sellers(db, date_from, date_to)
