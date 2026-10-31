CREATE TABLE customers (
  customer_id VARCHAR(32) PRIMARY KEY,
  customer_unique_id VARCHAR(32) NOT NULL,
  customer_zip_code_prefix VARCHAR(5),
  customer_city VARCHAR(60),
  customer_state CHAR(2)
);

CREATE TABLE sellers (
  seller_id VARCHAR(32) PRIMARY KEY,
  seller_zip_code_prefix VARCHAR(5),
  seller_city VARCHAR(60),
  seller_state CHAR(2)
);

CREATE TABLE category_translation (
  product_category_name VARCHAR(80) PRIMARY KEY,
  product_category_name_english VARCHAR(80)
);

CREATE TABLE products (
  product_id VARCHAR(32) PRIMARY KEY,
  product_category_name VARCHAR(80),
  product_name_length INT,
  product_description_length INT,
  product_photos_qty INT,
  product_weight_g INT,
  product_length_cm INT,
  product_height_cm INT,
  product_width_cm INT
);

CREATE TABLE orders (
  order_id VARCHAR(32) PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  order_status VARCHAR(20),
  order_purchase_timestamp DATETIME,
  order_approved_at DATETIME,
  order_delivered_carrier_date DATETIME,
  order_delivered_customer_date DATETIME,
  order_estimated_delivery_date DATETIME
);

CREATE TABLE order_items (
  order_id VARCHAR(32),
  order_item_id INT,
  product_id VARCHAR(32),
  seller_id VARCHAR(32),
  shipping_limit_date DATETIME,
  price DECIMAL(10,2),
  freight_value DECIMAL(10,2),
  PRIMARY KEY (order_id, order_item_id)
);

CREATE TABLE order_payments (
  order_id VARCHAR(32),
  payment_sequential INT,
  payment_type VARCHAR(20),
  payment_installments INT,
  payment_value DECIMAL(10,2),
  PRIMARY KEY (order_id, payment_sequential)
);

CREATE TABLE order_reviews (
  review_pk INT AUTO_INCREMENT PRIMARY KEY,
  review_id VARCHAR(32),
  order_id VARCHAR(32),
  review_score TINYINT,
  review_comment_title VARCHAR(255),
  review_comment_message TEXT,
  review_creation_date DATETIME,
  review_answer_timestamp DATETIME
);