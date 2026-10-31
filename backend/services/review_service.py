"""review_service.py - review analytics + review table."""
from datetime import date
from typing import Optional

from sqlalchemy.engine import Connection

from ..utils.db_helpers import date_filters, fetch_all, fetch_one, like, order_by, paginate, where_sql

SORTABLE = {
    "review_id": "r.review_id",
    "order_id": "r.order_id",
    "review_score": "r.review_score",
    "review_creation_date": "r.review_creation_date",
    "review_answer_timestamp": "r.review_answer_timestamp",
}


def get_reviews(db: Connection, score: Optional[int], order_id: Optional[str],
                date_from: Optional[date], date_to: Optional[date],
                sort: Optional[str], direction: str, page: int, limit: int) -> dict:
    # Summary cards + chart always describe ALL reviews matching the same filters
    where, params = [], {}
    if score:
        where.append("r.review_score = :score")
        params["score"] = score
    if order_id:
        where.append("r.order_id LIKE :order_id")
        params["order_id"] = like(order_id)
    date_filters("r.review_creation_date", date_from, date_to, where, params)

    # distribution ignores the score filter so the chart stays meaningful
    d_where, d_params = [], {}
    if order_id:
        d_where.append("r.order_id LIKE :order_id")
        d_params["order_id"] = like(order_id)
    date_filters("r.review_creation_date", date_from, date_to, d_where, d_params)
    d_where.append("r.review_score IS NOT NULL")
    dist_rows = {r["score"]: r["count"] for r in fetch_all(db, f"""
        SELECT r.review_score AS score, COUNT(*) AS count
        FROM order_reviews r {where_sql(d_where)} GROUP BY r.review_score""", d_params)}
    distribution = [{"score": s, "count": dist_rows.get(s, 0)} for s in range(1, 6)]
    total = sum(d["count"] for d in distribution)
    avg = (sum(d["score"] * d["count"] for d in distribution) / total) if total else None

    data_sql = f"""
        SELECT r.review_pk, r.review_id, r.order_id, r.review_score, r.review_comment_title,
               r.review_comment_message, r.review_creation_date, r.review_answer_timestamp
        FROM order_reviews r {where_sql(where)}
        ORDER BY {order_by(sort, direction, SORTABLE, 'review_creation_date')}, r.review_pk"""
    count_sql = f"SELECT COUNT(*) FROM order_reviews r {where_sql(where)}"
    table = paginate(db, count_sql, data_sql, params, page, limit)

    return {"summary": {"total_reviews": total, "avg_score": avg,
                        "by_score": {str(d["score"]): d["count"] for d in distribution}},
            "distribution": distribution, "table": table}
