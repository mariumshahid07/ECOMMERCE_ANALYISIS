-- OPTIONAL: speeds up searches on the full Olist dataset (~100k orders).
-- Your foreign keys already index most join columns. These cover the rest.
-- Run once in MySQL:  SOURCE sql/optional_indexes.sql;   (ignore "duplicate key" errors)
USE olist_ecommerce;
CREATE INDEX idx_orders_purchase  ON orders (order_purchase_timestamp);
CREATE INDEX idx_orders_status    ON orders (order_status);
CREATE INDEX idx_items_product    ON order_items (product_id);
CREATE INDEX idx_items_seller     ON order_items (seller_id);
CREATE INDEX idx_reviews_order    ON order_reviews (order_id);
CREATE INDEX idx_customers_unique ON customers (customer_unique_id);
CREATE INDEX idx_customers_state  ON customers (customer_state, customer_city);
CREATE INDEX idx_products_cat     ON products (product_category_name);
