"""customer_service.py - customers list + customer details."""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.engine import Connection

from ..utils.db_helpers import fetch_all, fetch_one, like, order_by, paginate, where_sql

SORTABLE = {
    "customer_id": "c.customer_id",
    "customer_unique_id": "c.customer_unique_id",
    "customer_city": "c.customer_city",
    "customer_state": "c.customer_state",
    "num_orders": "num_orders",
    "total_spent": "total_spent",
}


def list_customers(db: Connection, search: Optional[str], state: Optional[str],
                   city: Optional[str], sort: Optional[str], direction: str,
                   page: int, limit: int) -> dict:
    where, params = [], {}
    if search:
        where.append("(c.customer_id LIKE :q OR c.customer_unique_id LIKE :q)")
        params["q"] = like(search)
    if state:
        where.append("c.customer_state = :state")
        params["state"] = state
    if city:
        where.append("c.customer_city = :city")
        params["city"] = city

    data_sql = f"""
        SELECT c.customer_id, c.customer_unique_id, c.customer_city, c.customer_state,
               (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS num_orders,
               (SELECT COALESCE(SUM(oi.price + oi.freight_value), 0)
                  FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
                 WHERE o.customer_id = c.customer_id) AS total_spent
        FROM customers c
        {where_sql(where)}
        ORDER BY {order_by(sort, direction, SORTABLE, 'customer_id')}, c.customer_id"""
    count_sql = f"SELECT COUNT(*) FROM customers c {where_sql(where)}"
    return paginate(db, count_sql, data_sql, params, page, limit)


def get_customer(db: Connection, customer_id: str) -> dict:
    customer = fetch_one(db, "SELECT * FROM customers WHERE customer_id = :id", {"id": customer_id})
    if not customer:
        raise HTTPException(404, f"Customer '{customer_id}' not found")

    # In Olist, the same real person gets a NEW customer_id for each order, but keeps
    # the same customer_unique_id. So history is looked up by customer_unique_id.
    uid = {"uid": customer["customer_unique_id"]}
    orders = fetch_all(db, """
        SELECT o.order_id, o.customer_id, o.order_status, o.order_purchase_timestamp,
               (SELECT SUM(oi.price + oi.freight_value) FROM order_items oi
                 WHERE oi.order_id = o.order_id) AS order_value
        FROM orders o JOIN customers c ON c.customer_id = o.customer_id
        WHERE c.customer_unique_id = :uid
        ORDER BY o.order_purchase_timestamp DESC""", uid)

    reviews = fetch_all(db, """
        SELECT r.review_pk, r.order_id, r.review_score, r.review_comment_title,
               r.review_comment_message, r.review_creation_date
        FROM order_reviews r
        JOIN orders o ON o.order_id = r.order_id
        JOIN customers c ON c.customer_id = o.customer_id
        WHERE c.customer_unique_id = :uid
        ORDER BY r.review_creation_date DESC""", uid)

    total_spent = sum((o["order_value"] or 0) for o in orders)
    valued = [o for o in orders if o["order_value"] is not None]
    return {
        "customer": customer,
        "stats": {
            "total_orders": len(orders),
            "total_spent": total_spent,
            "avg_order_value": (total_spent / len(valued)) if valued else 0,
            "reviews_count": len(reviews),
        },
        "orders": orders,
        "reviews": reviews,
    }
