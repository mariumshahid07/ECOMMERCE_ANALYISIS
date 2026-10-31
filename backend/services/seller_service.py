"""seller_service.py - sellers list + seller details."""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.engine import Connection

from ..utils.db_helpers import fetch_all, fetch_one, like, order_by, paginate, where_sql

SORTABLE = {
    "seller_id": "s.seller_id",
    "seller_city": "s.seller_city",
    "seller_state": "s.seller_state",
    "products_sold": "products_sold",
    "total_orders": "total_orders",
    "revenue": "revenue",
    "avg_review_score": "avg_review_score",
}

# Sales numbers and review averages are computed in two separate sub-queries
# and then joined. (Joining reviews directly to items would count each item
# once per review and inflate the revenue.)
BASE = """
    FROM sellers s
    LEFT JOIN (SELECT seller_id,
                      COUNT(DISTINCT product_id) AS products_sold,
                      COUNT(DISTINCT order_id)   AS total_orders,
                      SUM(price)                 AS revenue
               FROM order_items GROUP BY seller_id) agg ON agg.seller_id = s.seller_id
    LEFT JOIN (SELECT x.seller_id, AVG(r.review_score) AS avg_review_score
               FROM (SELECT DISTINCT seller_id, order_id FROM order_items) x
               JOIN order_reviews r ON r.order_id = x.order_id
               GROUP BY x.seller_id) rv ON rv.seller_id = s.seller_id
"""


def list_sellers(db: Connection, search: Optional[str], state: Optional[str],
                 sort: Optional[str], direction: str, page: int, limit: int) -> dict:
    where, params = [], {}
    if search:
        where.append("(s.seller_id LIKE :q OR s.seller_city LIKE :q)")
        params["q"] = like(search)
    if state:
        where.append("s.seller_state = :state")
        params["state"] = state

    data_sql = f"""
        SELECT s.seller_id, s.seller_city, s.seller_state,
               COALESCE(agg.products_sold, 0) AS products_sold,
               COALESCE(agg.total_orders, 0)  AS total_orders,
               COALESCE(agg.revenue, 0)       AS revenue,
               rv.avg_review_score
        {BASE} {where_sql(where)}
        ORDER BY {order_by(sort, direction, SORTABLE, 'revenue')}, s.seller_id"""
    count_sql = f"SELECT COUNT(*) FROM sellers s {where_sql(where)}"
    return paginate(db, count_sql, data_sql, params, page, limit)


def get_seller(db: Connection, seller_id: str) -> dict:
    seller = fetch_one(db, "SELECT * FROM sellers WHERE seller_id = :id", {"id": seller_id})
    if not seller:
        raise HTTPException(404, f"Seller '{seller_id}' not found")
    p = {"id": seller_id}

    stats = fetch_one(db, """
        SELECT COUNT(*) AS items_sold,
               COUNT(DISTINCT order_id) AS total_orders,
               COUNT(DISTINCT product_id) AS products_sold,
               COALESCE(SUM(price), 0) AS revenue,
               COALESCE(SUM(freight_value), 0) AS freight,
               AVG(price) AS avg_item_price
        FROM order_items WHERE seller_id = :id""", p)
    stats["avg_order_value"] = (stats["revenue"] / stats["total_orders"]) if stats["total_orders"] else 0

    perf = fetch_one(db, """
        SELECT AVG(r.review_score) AS avg_review_score, COUNT(*) AS reviews
        FROM (SELECT DISTINCT order_id FROM order_items WHERE seller_id = :id) x
        JOIN order_reviews r ON r.order_id = x.order_id""", p)
    delivery = fetch_one(db, """
        SELECT COUNT(*) AS delivered_orders,
               SUM(o.order_delivered_customer_date <= o.order_estimated_delivery_date) AS on_time,
               AVG(DATEDIFF(o.order_delivered_customer_date, o.order_purchase_timestamp)) AS avg_delivery_days
        FROM (SELECT DISTINCT order_id FROM order_items WHERE seller_id = :id) x
        JOIN orders o ON o.order_id = x.order_id
        WHERE o.order_delivered_customer_date IS NOT NULL""", p)
    delivered = delivery["delivered_orders"] or 0
    stats.update({
        "avg_review_score": perf["avg_review_score"],
        "reviews": perf["reviews"],
        "on_time_rate": (float(delivery["on_time"] or 0) / delivered * 100) if delivered else None,
        "avg_delivery_days": delivery["avg_delivery_days"],
    })

    products = fetch_all(db, """
        SELECT oi.product_id,
               COALESCE(ct.product_category_name_english, p.product_category_name) AS category,
               COUNT(*) AS units_sold, SUM(oi.price) AS revenue
        FROM order_items oi
        LEFT JOIN products p ON p.product_id = oi.product_id
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        WHERE oi.seller_id = :id
        GROUP BY oi.product_id, category ORDER BY revenue DESC LIMIT 20""", p)

    orders = fetch_all(db, """
        SELECT o.order_id, o.order_status, o.order_purchase_timestamp,
               SUM(oi.price) AS seller_revenue, COUNT(*) AS items
        FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
        WHERE oi.seller_id = :id
        GROUP BY o.order_id, o.order_status, o.order_purchase_timestamp
        ORDER BY o.order_purchase_timestamp DESC LIMIT 20""", p)

    monthly = fetch_all(db, """
        SELECT DATE_FORMAT(o.order_purchase_timestamp, '%Y-%m') AS month, SUM(oi.price) AS revenue
        FROM order_items oi JOIN orders o ON o.order_id = oi.order_id
        WHERE oi.seller_id = :id AND o.order_purchase_timestamp IS NOT NULL
        GROUP BY month ORDER BY month""", p)

    return {"seller": seller, "stats": stats, "products": products,
            "orders": orders, "monthly_revenue": monthly}
