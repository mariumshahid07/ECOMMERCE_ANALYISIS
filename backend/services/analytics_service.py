"""
analytics_service.py - the five "Analytics" tabs.
Every function accepts an optional purchase-date range.
"""
from datetime import date
from typing import Optional

from sqlalchemy.engine import Connection

from ..utils.db_helpers import date_filters, fetch_all, fetch_one, where_sql

CAT = "COALESCE(ct.product_category_name_english, p.product_category_name, 'unknown')"


def _range(date_from: Optional[date], date_to: Optional[date]):
    where, params = [], {}
    date_filters("o.order_purchase_timestamp", date_from, date_to, where, params)
    return where, params


def sales(db: Connection, date_from, date_to) -> dict:
    where, params = _range(date_from, date_to)
    w = where_sql(where + ["o.order_purchase_timestamp IS NOT NULL"])

    monthly = fetch_all(db, f"""
        SELECT DATE_FORMAT(o.order_purchase_timestamp, '%Y-%m') AS month,
               SUM(oi.price) AS revenue,
               COUNT(DISTINCT o.order_id) AS orders,
               SUM(oi.price) / COUNT(DISTINCT o.order_id) AS avg_order_value
        FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
        {w} GROUP BY month ORDER BY month""", params)
    # sales trend = month-over-month growth (%), computed from the monthly rows
    prev = None
    for m in monthly:
        rev = float(m["revenue"] or 0)
        m["growth_pct"] = ((rev - prev) / prev * 100) if prev else None
        prev = rev

    by_category = fetch_all(db, f"""
        SELECT {CAT} AS category, SUM(oi.price) AS revenue, COUNT(*) AS units
        FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
        JOIN products p ON p.product_id = oi.product_id
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        {where_sql(where)} GROUP BY category ORDER BY revenue DESC LIMIT 15""", params)

    by_state = fetch_all(db, f"""
        SELECT c.customer_state AS state, SUM(oi.price) AS revenue,
               COUNT(DISTINCT o.order_id) AS orders
        FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
        JOIN customers c ON c.customer_id = o.customer_id
        {where_sql(where)} GROUP BY c.customer_state ORDER BY revenue DESC""", params)

    overall = fetch_one(db, f"""
        SELECT COALESCE(SUM(oi.price), 0) AS revenue,
               COUNT(DISTINCT o.order_id) AS orders,
               COALESCE(SUM(oi.price) / NULLIF(COUNT(DISTINCT o.order_id), 0), 0) AS avg_order_value
        FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
        {where_sql(where)}""", params)

    return {"overall": overall, "monthly": monthly, "by_category": by_category, "by_state": by_state}


def orders(db: Connection, date_from, date_to) -> dict:
    where, params = _range(date_from, date_to)
    w = where_sql(where + ["o.order_purchase_timestamp IS NOT NULL"])

    monthly = fetch_all(db, f"""
        SELECT DATE_FORMAT(o.order_purchase_timestamp, '%Y-%m') AS month, COUNT(*) AS orders
        FROM orders o {w} GROUP BY month ORDER BY month""", params)

    by_status = fetch_all(db, f"""
        SELECT COALESCE(o.order_status, 'unknown') AS status, COUNT(*) AS count
        FROM orders o {where_sql(where)} GROUP BY status ORDER BY count DESC""", params)

    dw = where_sql(where + ["o.order_delivered_customer_date IS NOT NULL"])
    delivery = fetch_one(db, f"""
        SELECT COUNT(*) AS delivered_orders,
               COALESCE(SUM(o.order_delivered_customer_date <= o.order_estimated_delivery_date), 0) AS on_time,
               COALESCE(SUM(o.order_delivered_customer_date > o.order_estimated_delivery_date), 0) AS late,
               AVG(DATEDIFF(o.order_delivered_customer_date, o.order_purchase_timestamp)) AS avg_actual_days,
               AVG(DATEDIFF(o.order_estimated_delivery_date, o.order_purchase_timestamp)) AS avg_estimated_days
        FROM orders o {dw}""", params)
    n = delivery["delivered_orders"] or 0
    delivery["on_time_rate"] = (float(delivery["on_time"]) / n * 100) if n else None

    est_vs_actual = fetch_all(db, f"""
        SELECT DATE_FORMAT(o.order_purchase_timestamp, '%Y-%m') AS month,
               AVG(DATEDIFF(o.order_delivered_customer_date, o.order_purchase_timestamp)) AS actual_days,
               AVG(DATEDIFF(o.order_estimated_delivery_date, o.order_purchase_timestamp)) AS estimated_days
        FROM orders o {dw} AND o.order_purchase_timestamp IS NOT NULL
        GROUP BY month ORDER BY month""", params)

    return {"monthly": monthly, "by_status": by_status,
            "delivery": delivery, "estimated_vs_actual": est_vs_actual}


def customers(db: Connection, date_from, date_to) -> dict:
    where, params = _range(date_from, date_to)
    base = f"FROM orders o JOIN customers c ON c.customer_id = o.customer_id {where_sql(where)}"

    by_state = fetch_all(db, f"""
        SELECT c.customer_state AS state, COUNT(DISTINCT c.customer_unique_id) AS customers
        {base} GROUP BY c.customer_state ORDER BY customers DESC""", params)
    by_city = fetch_all(db, f"""
        SELECT c.customer_city AS city, c.customer_state AS state,
               COUNT(DISTINCT c.customer_unique_id) AS customers
        {base} GROUP BY c.customer_city, c.customer_state ORDER BY customers DESC LIMIT 15""", params)

    top_customers = fetch_all(db, f"""
        SELECT c.customer_unique_id, MAX(c.customer_city) AS city, MAX(c.customer_state) AS state,
               COUNT(DISTINCT o.order_id) AS orders, SUM(oi.price + oi.freight_value) AS total_spent
        FROM orders o JOIN customers c ON c.customer_id = o.customer_id
        JOIN order_items oi ON oi.order_id = o.order_id
        {where_sql(where)}
        GROUP BY c.customer_unique_id ORDER BY total_spent DESC LIMIT 10""", params)

    repeat = fetch_one(db, f"""
        SELECT COUNT(*) AS total_customers,
               COALESCE(SUM(t.n > 1), 0) AS repeat_customers,
               COALESCE(SUM(t.n = 1), 0) AS one_time_customers
        FROM (SELECT c.customer_unique_id, COUNT(DISTINCT o.order_id) AS n
              {base} GROUP BY c.customer_unique_id) t""", params)
    tot = repeat["total_customers"] or 0
    repeat["repeat_rate"] = (float(repeat["repeat_customers"]) / tot * 100) if tot else None

    return {"by_state": by_state, "by_city": by_city,
            "top_customers": top_customers, "repeat": repeat}


def products(db: Connection, date_from, date_to) -> dict:
    where, params = _range(date_from, date_to)
    base = f"""FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
               JOIN products p ON p.product_id = oi.product_id
               LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
               {where_sql(where)}"""
    best_selling = fetch_all(db, f"""
        SELECT oi.product_id, {CAT} AS category, COUNT(*) AS units_sold, SUM(oi.price) AS revenue
        {base} GROUP BY oi.product_id, category ORDER BY units_sold DESC, revenue DESC LIMIT 10""", params)
    top_revenue = fetch_all(db, f"""
        SELECT oi.product_id, {CAT} AS category, COUNT(*) AS units_sold, SUM(oi.price) AS revenue
        {base} GROUP BY oi.product_id, category ORDER BY revenue DESC LIMIT 10""", params)
    category_perf = fetch_all(db, f"""
        SELECT {CAT} AS category, COUNT(*) AS units_sold, SUM(oi.price) AS revenue,
               AVG(oi.price) AS avg_price, COUNT(DISTINCT oi.order_id) AS orders
        {base} GROUP BY category ORDER BY revenue DESC LIMIT 15""", params)
    return {"best_selling": best_selling, "top_revenue": top_revenue, "category_performance": category_perf}


def sellers(db: Connection, date_from, date_to) -> dict:
    where, params = _range(date_from, date_to)
    base = f"""FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
               JOIN sellers s ON s.seller_id = oi.seller_id {where_sql(where)}"""
    top_revenue = fetch_all(db, f"""
        SELECT s.seller_id, s.seller_city, s.seller_state,
               SUM(oi.price) AS revenue, COUNT(DISTINCT o.order_id) AS orders
        {base} GROUP BY s.seller_id, s.seller_city, s.seller_state
        ORDER BY revenue DESC LIMIT 10""", params)
    top_orders = fetch_all(db, f"""
        SELECT s.seller_id, s.seller_city, s.seller_state,
               SUM(oi.price) AS revenue, COUNT(DISTINCT o.order_id) AS orders
        {base} GROUP BY s.seller_id, s.seller_city, s.seller_state
        ORDER BY orders DESC, revenue DESC LIMIT 10""", params)
    by_state = fetch_all(db, f"""
        SELECT s.seller_state AS state, COUNT(DISTINCT s.seller_id) AS sellers, SUM(oi.price) AS revenue
        {base} GROUP BY s.seller_state ORDER BY revenue DESC""", params)
    return {"top_revenue": top_revenue, "top_orders": top_orders, "by_state": by_state}
