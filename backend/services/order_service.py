"""order_service.py - orders list + order details."""
from datetime import date
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.engine import Connection

from ..utils.db_helpers import (
    date_filters, fetch_all, fetch_one, like, order_by, paginate, where_sql,
)

SORTABLE = {
    "order_id": "o.order_id",
    "customer_id": "o.customer_id",
    "order_status": "o.order_status",
    "order_purchase_timestamp": "o.order_purchase_timestamp",
    "order_approved_at": "o.order_approved_at",
    "order_delivered_customer_date": "o.order_delivered_customer_date",
    "order_estimated_delivery_date": "o.order_estimated_delivery_date",
    "order_value": "order_value",
}


def list_orders(db: Connection, order_id: Optional[str], customer_id: Optional[str],
                status: Optional[str], date_from: Optional[date], date_to: Optional[date],
                sort: Optional[str], direction: str, page: int, limit: int) -> dict:
    where, params = [], {}
    if order_id:
        where.append("o.order_id LIKE :order_id")
        params["order_id"] = like(order_id)
    if customer_id:
        where.append("o.customer_id LIKE :customer_id")
        params["customer_id"] = like(customer_id)
    if status:
        where.append("o.order_status = :status")
        params["status"] = status
    date_filters("o.order_purchase_timestamp", date_from, date_to, where, params)

    # order_value = items price + freight. A correlated sub-select is used so
    # MySQL only has to compute it for the rows we actually return.
    data_sql = f"""
        SELECT o.order_id, o.customer_id, o.order_status, o.order_purchase_timestamp,
               o.order_approved_at, o.order_delivered_customer_date,
               o.order_estimated_delivery_date,
               (SELECT SUM(oi.price + oi.freight_value) FROM order_items oi
                 WHERE oi.order_id = o.order_id) AS order_value
        FROM orders o
        {where_sql(where)}
        ORDER BY {order_by(sort, direction, SORTABLE, 'order_purchase_timestamp')}, o.order_id"""
    count_sql = f"SELECT COUNT(*) FROM orders o {where_sql(where)}"
    return paginate(db, count_sql, data_sql, params, page, limit)


def get_order(db: Connection, order_id: str) -> dict:
    order = fetch_one(db, """
        SELECT o.*, c.customer_unique_id, c.customer_city, c.customer_state,
               c.customer_zip_code_prefix
        FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.order_id = :id""", {"id": order_id})
    if not order:
        raise HTTPException(404, f"Order '{order_id}' not found")

    # ONE query for all items (with product + seller + category) -> no N+1 problem
    items = fetch_all(db, """
        SELECT oi.order_item_id, oi.product_id,
               COALESCE(ct.product_category_name_english, p.product_category_name) AS category,
               oi.seller_id, s.seller_city, s.seller_state,
               oi.shipping_limit_date, oi.price, oi.freight_value
        FROM order_items oi
        LEFT JOIN products p ON p.product_id = oi.product_id
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        LEFT JOIN sellers s ON s.seller_id = oi.seller_id
        WHERE oi.order_id = :id ORDER BY oi.order_item_id""", {"id": order_id})

    payments = fetch_all(db, """
        SELECT payment_sequential, payment_type, payment_installments, payment_value
        FROM order_payments WHERE order_id = :id ORDER BY payment_sequential""", {"id": order_id})

    reviews = fetch_all(db, """
        SELECT review_pk, review_id, review_score, review_comment_title,
               review_comment_message, review_creation_date, review_answer_timestamp
        FROM order_reviews WHERE order_id = :id ORDER BY review_creation_date""", {"id": order_id})

    return {
        "order": order,
        "items": items,
        "payments": payments,
        "reviews": reviews,
        "totals": {
            "items_total": sum((i["price"] or 0) for i in items),
            "freight_total": sum((i["freight_value"] or 0) for i in items),
            "paid_total": sum((p["payment_value"] or 0) for p in payments),
        },
    }
