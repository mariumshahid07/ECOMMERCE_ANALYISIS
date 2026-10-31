"""meta_service.py - values that fill the dropdown filters in the UI."""
from typing import Optional

from sqlalchemy import distinct, select
from sqlalchemy.engine import Connection

from ..models.tables import customers, orders, sellers
from ..utils.db_helpers import fetch_all


def get_filter_options(db: Connection) -> dict:
    # Example of SQLAlchemy "Core" (Python expressions instead of raw SQL)
    statuses = db.execute(select(distinct(orders.c.order_status)).order_by(orders.c.order_status)).scalars().all()
    cust_states = db.execute(select(distinct(customers.c.customer_state)).order_by(customers.c.customer_state)).scalars().all()
    sell_states = db.execute(select(distinct(sellers.c.seller_state)).order_by(sellers.c.seller_state)).scalars().all()
    categories = fetch_all(db, """
        SELECT p.product_category_name AS name,
               COALESCE(ct.product_category_name_english, p.product_category_name) AS label
        FROM (SELECT DISTINCT product_category_name FROM products
              WHERE product_category_name IS NOT NULL) p
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        ORDER BY label""")
    payment_types = [r["payment_type"] for r in fetch_all(
        db, "SELECT DISTINCT payment_type FROM order_payments WHERE payment_type IS NOT NULL ORDER BY 1")]
    return {
        "order_statuses": [s for s in statuses if s],
        "customer_states": [s for s in cust_states if s],
        "seller_states": [s for s in sell_states if s],
        "categories": categories,
        "payment_types": payment_types,
    }


def get_cities(db: Connection, state: Optional[str]) -> list[str]:
    sql = "SELECT DISTINCT customer_city FROM customers WHERE customer_city IS NOT NULL"
    params = {}
    if state:
        sql += " AND customer_state = :state"
        params["state"] = state
    sql += " ORDER BY customer_city"
    return [r["customer_city"] for r in fetch_all(db, sql, params)]
