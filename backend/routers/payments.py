from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.engine import Connection

from ..database import get_db
from ..services import payment_service

router = APIRouter(prefix="/api/payments", tags=["Payments"])


@router.get("")
def payments(date_from: Optional[date] = None, date_to: Optional[date] = None,
             payment_type: Optional[str] = None, db: Connection = Depends(get_db)):
    return payment_service.get_payments(db, date_from, date_to, payment_type)
