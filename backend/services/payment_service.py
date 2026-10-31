"""payment_service.py - payment analytics."""
from datetime import date
from typing import Optional

from sqlalchemy.engine import Connection

from ..utils.db_helpers import date_filters, fetch_all, fetch_one, where_sql


def get_payments(db: Connection, date_from: Optional[date], date_to: Optional[date],
                 payment_type: Optional[str]) -> dict:
    where, params = [], {}
    date_filters("o.order_purchase_timestamp", date_from, date_to, where, params)
    if payment_type:
        where.append("p.payment_type = :ptype")
        params["ptype"] = payment_type
    base = f"FROM order_payments p JOIN orders o ON o.order_id = p.order_id {where_sql(where)}"

    summary = fetch_one(db, f"""
        SELECT COALESCE(SUM(p.payment_value), 0) AS total_value,
               COALESCE(AVG(p.payment_value), 0) AS avg_value,
               COUNT(*) AS num_payments,
               COALESCE(AVG(p.payment_installments), 0) AS avg_installments
        {base}""", params)

    by_type = fetch_all(db, f"""
        SELECT COALESCE(p.payment_type, 'unknown') AS payment_type,
               COUNT(*) AS count, SUM(p.payment_value) AS value
        {base} GROUP BY payment_type ORDER BY value DESC""", params)

    over_time = fetch_all(db, f"""
        SELECT DATE_FORMAT(o.order_purchase_timestamp, '%Y-%m') AS month,
               SUM(p.payment_value) AS value, COUNT(*) AS payments
        {base} {'AND' if where else 'WHERE'} o.order_purchase_timestamp IS NOT NULL
        GROUP BY month ORDER BY month""", params)

    installments = fetch_all(db, f"""
        SELECT p.payment_installments AS installments, COUNT(*) AS count
        {base} {'AND' if where else 'WHERE'} p.payment_installments IS NOT NULL
        GROUP BY p.payment_installments ORDER BY p.payment_installments""", params)

    return {"summary": summary, "by_type": by_type, "over_time": over_time,
            "installments": installments}
