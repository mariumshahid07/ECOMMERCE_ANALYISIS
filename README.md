# E-commerce Sales & Customer Analytics

A SQL and application project built on the [Olist Brazilian E-commerce dataset](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) from Kaggle. It covers database design, data loading, analytical SQL queries, and a backend and frontend that serve the results.

## Overview

- Designed a relational schema in **MySQL 8.0** with 8 tables and 6 foreign keys
- Loaded and validated data from the source CSV files (row counts reconciled)
- Cleaned invalid dates in the `order_reviews` table
- Built a Python backend that exposes analytics from the database
- Added a frontend to display the results

## Tech Stack

- **Database:** MySQL 8.0
- **Backend:** Python (FastAPI)
- **Frontend:** HTML / CSS / JavaScript
- **Tools:** MySQL Workbench, GitHub Desktop

## Database Design

The database `olist_ecommerce` contains these tables: customers, orders, order_items, order_payments, order_reviews, products, sellers and product_category_name_translation.

The full diagram is in [Olist_EER_diagram.pdf](Olist_EER_diagram.pdf).


<!-- SCREENSHOT 1: EER diagram image -->
<img width="893" height="1157" alt="image" src="https://github.com/user-attachments/assets/d6150bcf-3c28-4823-86fa-bf5c64db3ac5" />


## Setup

1. Download the dataset from Kaggle and place the CSV files in a `data/` folder.
2. Log in to MySQL:
   ```bash
   mysql --local-infile=1 -u root -p
   ```
3. Create the database and run the schema:
   ```sql
   CREATE DATABASE olist_ecommerce;
   USE olist_ecommerce;
   SOURCE 01_schema.sql;
   ```
4. Load the CSV files with `LOAD DATA LOCAL INFILE`.
5. Install the Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
6. Update the database credentials in `backend/config.py`.
7. Start the backend:
   ```bash
   uvicorn backend.main:app --reload
   ```


### Application Dashboard
![Dashboard 1](SCREENSHOTS%20OF%20APPLICATION%20DASHBOARD/app_1.png)
![Dashboard 2](SCREENSHOTS%20OF%20APPLICATION%20DASHBOARD/app_2.png)
![Dashboard 3](SCREENSHOTS%20OF%20APPLICATION%20DASHBOARD/app_3.png)
![Dashboard 4](SCREENSHOTS%20OF%20APPLICATION%20DASHBOARD/app_4.png)
![Dashboard 5](SCREENSHOTS%20OF%20APPLICATION%20DASHBOARD/app_5.png)
![Dashboard 6](SCREENSHOTS%20OF%20APPLICATION%20DASHBOARD/app_6.png)
![Dashboard 7](SCREENSHOTS%20OF%20APPLICATION%20DASHBOARD/app_7.png)



## Author

Marium
