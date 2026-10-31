"""
schemas/common.py - Pydantic models describe the JSON the API returns.
FastAPI uses them to validate responses and to build the /docs page.
"""
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel


class Page(BaseModel):
    """Every list endpoint returns this shape (server-side pagination)."""
    items: list[dict[str, Any]]
    total: int
    page: int
    limit: int
    pages: int


class DashboardKPIs(BaseModel):
    total_orders: int
    total_customers: int
    total_sellers: int
    total_products: int
    total_revenue: Decimal
    avg_order_value: Decimal
    avg_review_score: Optional[Decimal] = None
    total_freight: Decimal


class OrderRow(BaseModel):
    order_id: str
    customer_id: str
    order_status: Optional[str] = None
    order_purchase_timestamp: Optional[datetime] = None
    order_approved_at: Optional[datetime] = None
    order_delivered_customer_date: Optional[datetime] = None
    order_estimated_delivery_date: Optional[datetime] = None
    order_value: Optional[Decimal] = None


class OrderPage(BaseModel):
    items: list[OrderRow]
    total: int
    page: int
    limit: int
    pages: int
