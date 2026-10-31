"""product_service.py - products list, product details, categories."""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.engine import Connection

from ..utils.db_helpers import fetch_all, fetch_one, like, order_by, paginate, where_sql

SORTABLE = {
    "product_id": "p.product_id",
    "category": "category",
    "product_name_length": "p.product_name_length",
    "product_description_length": "p.product_description_length",
    "product_photos_qty": "p.product_photos_qty",
    "product_weight_g": "p.product_weight_g",
    "product_length_cm": "p.product_length_cm",
    "product_height_cm": "p.product_height_cm",
    "product_width_cm": "p.product_width_cm",
}


def list_products(db: Connection, search: Optional[str], category: Optional[str],
                  sort: Optional[str], direction: str, page: int, limit: int) -> dict:
    where, params = [], {}
    if search:
        where.append("(p.product_id LIKE :q OR p.product_category_name LIKE :q "
                     "OR ct.product_category_name_english LIKE :q)")
        params["q"] = like(search)
    if category:
        where.append("p.product_category_name = :category")
        params["category"] = category

    base = """FROM products p
              LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name"""
    data_sql = f"""
        SELECT p.product_id, p.product_category_name,
               COALESCE(ct.product_category_name_english, p.product_category_name) AS category,
               p.product_name_length, p.product_description_length, p.product_photos_qty,
               p.product_weight_g, p.product_length_cm, p.product_height_cm, p.product_width_cm
        {base} {where_sql(where)}
        ORDER BY {order_by(sort, direction, SORTABLE, 'product_id')}, p.product_id"""
    count_sql = f"SELECT COUNT(*) {base} {where_sql(where)}"
    return paginate(db, count_sql, data_sql, params, page, limit)


def get_product(db: Connection, product_id: str) -> dict:
    product = fetch_one(db, """
        SELECT p.*, ct.product_category_name_english
        FROM products p
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        WHERE p.product_id = :id""", {"id": product_id})
    if not product:
        raise HTTPException(404, f"Product '{product_id}' not found")

    sales = fetch_one(db, """
        SELECT COUNT(*) AS units_sold,
               COUNT(DISTINCT order_id) AS orders,
               COALESCE(SUM(price), 0) AS revenue,
               AVG(price) AS avg_selling_price,
               COALESCE(SUM(freight_value), 0) AS total_freight
        FROM order_items WHERE product_id = :id""", {"id": product_id})

    sellers = fetch_all(db, """
        SELECT s.seller_id, s.seller_city, s.seller_state,
               COUNT(*) AS units_sold, SUM(oi.price) AS revenue
        FROM order_items oi JOIN sellers s ON s.seller_id = oi.seller_id
        WHERE oi.product_id = :id
        GROUP BY s.seller_id, s.seller_city, s.seller_state
        ORDER BY revenue DESC LIMIT 10""", {"id": product_id})
    return {"product": product, "sales": sales, "sellers": sellers}


def list_categories(db: Connection, search: Optional[str]) -> list[dict]:
    """
    One row per category. We start from `products` (so categories missing from the
    translation table still appear) and LEFT JOIN the translation + order items.
    """
    where, params = [], {}
    if search:
        where.append("(p.product_category_name LIKE :q OR ct.product_category_name_english LIKE :q)")
        params["q"] = like(search)
    return fetch_all(db, f"""
        SELECT p.product_category_name AS category_pt,
               ct.product_category_name_english AS category_en,
               COUNT(DISTINCT p.product_id) AS num_products,
               COUNT(DISTINCT oi.order_id) AS num_orders,
               COALESCE(SUM(oi.price), 0) AS revenue
        FROM products p
        LEFT JOIN category_translation ct ON ct.product_category_name = p.product_category_name
        LEFT JOIN order_items oi ON oi.product_id = p.product_id
        {where_sql(where)}
        GROUP BY p.product_category_name, ct.product_category_name_english
        ORDER BY revenue DESC""", params)
