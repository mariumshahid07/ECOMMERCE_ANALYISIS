"""dashboard_service.py - KPI cards + the 7 dashboard charts/tables."""
from sqlalchemy.engine import Connection

from ..utils.db_helpers import fetch_all, fetch_one

CATEGORY_LABEL = "COALESCE(ct.product_category_name_english, p.product_category_name, 'unknown')"


def get_dashboard(db: Connection) -> dict:
    # --- KPI cards: ONE query, all numbers computed by MySQL (SQL aggregation) ---
    kpis = fetch_one(db, """
        SELECT
          (SELECT COUNT(*) FROM orders)                              AS total_orders,
          (SELECT COUNT(DISTINCT customer_unique_id) FROM customers) AS total_customers,
          (SELECT COUNT(*) FROM sellers)                             AS total_sellers,
          (SELECT COUNT(*) FROM products)                            AS total_products,
          (SELECT COALESCE(SUM(price), 0) FROM order_items)          AS total_revenue,
          (SELECT COALESCE(SUM(price) / NULLIF(COUNT(DISTINCT order_id), 0), 0)
             FROM order_items)                                       AS avg_order_value,
          (SELECT AVG(review_score) FROM order_reviews)              AS avg_review_score,
          (SELECT COALESCE(SUM(freight_value), 0) FROM order_items)  AS total_freight
    """)

    sales_over_time = fetch_all(db, """
        SELECT DATE_FORMAT(o.order_purchase_timestamp, '%Y-%m') AS month,
               SUM(oi.price) AS revenue,
               COUNT(DISTINCT o.order_id) AS orders
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.order_id
        WHERE o.order_purchase_timestamp IS NOT NULL
        GROUP BY month ORDER BY month""")

    orders_by_status = fetch_all(db, """
        SELECT COALESCE(order_status, 'unknown') AS status, COUNT(*) AS count
        FROM orders GROUP BY status ORDER BY count DESC""")

    revenue_by_category = fetch_all(db, f"""
        SELECT {CATEGORY_LABEL} AS category, SUM(oi.price) AS revenue
        FROM order_items oi
        JOIN products p ON p.product_id = oi.product_id
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        GROUP BY category ORDER BY revenue DESC LIMIT 10""")

    payment_types = fetch_all(db, """
        SELECT COALESCE(payment_type, 'unknown') AS payment_type,
               COUNT(*) AS count, SUM(payment_value) AS value
        FROM order_payments GROUP BY payment_type ORDER BY count DESC""")

    scores = {r["score"]: r["count"] for r in fetch_all(db, """
        SELECT review_score AS score, COUNT(*) AS count
        FROM order_reviews WHERE review_score IS NOT NULL GROUP BY review_score""")}
    review_scores = [{"score": s, "count": scores.get(s, 0)} for s in range(1, 6)]

    top_products = fetch_all(db, f"""
        SELECT oi.product_id, {CATEGORY_LABEL} AS category,
               COUNT(*) AS units_sold, SUM(oi.price) AS revenue
        FROM order_items oi
        JOIN products p ON p.product_id = oi.product_id
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        GROUP BY oi.product_id, category ORDER BY revenue DESC LIMIT 10""")

    top_sellers = fetch_all(db, """
        SELECT s.seller_id, s.seller_city, s.seller_state,
               COUNT(DISTINCT oi.order_id) AS orders, SUM(oi.price) AS revenue
        FROM order_items oi JOIN sellers s ON s.seller_id = oi.seller_id
        GROUP BY s.seller_id, s.seller_city, s.seller_state
        ORDER BY revenue DESC LIMIT 10""")

    return {
        "kpis": kpis,
        "sales_over_time": sales_over_time,
        "orders_by_status": orders_by_status,
        "revenue_by_category": revenue_by_category,
        "payment_types": payment_types,
        "review_scores": review_scores,
        "top_products": top_products,
        "top_sellers": top_sellers,
    }
