"""
models/tables.py - the database tables described in Python.

These mirror 01_schema.sql EXACTLY (same table and column names).
They are used by the app to check that the database matches what we expect
(see `check_schema` in main.py) and as a readable reference for students.

The heavy analytics queries are written as plain SQL in `services/`,
because SQL is the clearest way to express JOINs and GROUP BYs.
"""
from sqlalchemy import (
    Column, DECIMAL, DateTime, Integer, MetaData, SmallInteger, String, Table, Text,
)

metadata = MetaData()

customers = Table(
    "customers", metadata,
    Column("customer_id", String(32), primary_key=True),
    Column("customer_unique_id", String(32), nullable=False),
    Column("customer_zip_code_prefix", String(5)),
    Column("customer_city", String(60)),
    Column("customer_state", String(2)),
)

sellers = Table(
    "sellers", metadata,
    Column("seller_id", String(32), primary_key=True),
    Column("seller_zip_code_prefix", String(5)),
    Column("seller_city", String(60)),
    Column("seller_state", String(2)),
)

category_translation = Table(
    "category_translation", metadata,
    Column("product_category_name", String(80), primary_key=True),
    Column("product_category_name_english", String(80)),
)

products = Table(
    "products", metadata,
    Column("product_id", String(32), primary_key=True),
    Column("product_category_name", String(80)),
    Column("product_name_length", Integer),
    Column("product_description_length", Integer),
    Column("product_photos_qty", Integer),
    Column("product_weight_g", Integer),
    Column("product_length_cm", Integer),
    Column("product_height_cm", Integer),
    Column("product_width_cm", Integer),
)

orders = Table(
    "orders", metadata,
    Column("order_id", String(32), primary_key=True),
    Column("customer_id", String(32), nullable=False),
    Column("order_status", String(20)),
    Column("order_purchase_timestamp", DateTime),
    Column("order_approved_at", DateTime),
    Column("order_delivered_carrier_date", DateTime),
    Column("order_delivered_customer_date", DateTime),
    Column("order_estimated_delivery_date", DateTime),
)

order_items = Table(
    "order_items", metadata,
    Column("order_id", String(32), primary_key=True),
    Column("order_item_id", Integer, primary_key=True),
    Column("product_id", String(32)),
    Column("seller_id", String(32)),
    Column("shipping_limit_date", DateTime),
    Column("price", DECIMAL(10, 2)),
    Column("freight_value", DECIMAL(10, 2)),
)

order_payments = Table(
    "order_payments", metadata,
    Column("order_id", String(32), primary_key=True),
    Column("payment_sequential", Integer, primary_key=True),
    Column("payment_type", String(20)),
    Column("payment_installments", Integer),
    Column("payment_value", DECIMAL(10, 2)),
)

order_reviews = Table(
    "order_reviews", metadata,
    Column("review_pk", Integer, primary_key=True, autoincrement=True),
    Column("review_id", String(32)),
    Column("order_id", String(32)),
    Column("review_score", SmallInteger),
    Column("review_comment_title", String(255)),
    Column("review_comment_message", Text),
    Column("review_creation_date", DateTime),
    Column("review_answer_timestamp", DateTime),
)
