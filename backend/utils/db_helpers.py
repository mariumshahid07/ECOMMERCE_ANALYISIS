"""
utils/db_helpers.py - small helpers shared by all services.
"""
import math
from datetime import date
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.engine import Connection

MAX_LIMIT = 100


def fetch_all(db: Connection, sql: str, params: Optional[dict] = None) -> list[dict[str, Any]]:
    """Run a SELECT and return a list of dicts (one dict per row)."""
    return [dict(r) for r in db.execute(text(sql), params or {}).mappings()]


def fetch_one(db: Connection, sql: str, params: Optional[dict] = None) -> Optional[dict[str, Any]]:
    row = db.execute(text(sql), params or {}).mappings().first()
    return dict(row) if row else None


def fetch_scalar(db: Connection, sql: str, params: Optional[dict] = None) -> Any:
    return db.execute(text(sql), params or {}).scalar()


def like(value: str) -> str:
    """Turn user text into a safe LIKE pattern:  abc -> %abc%"""
    value = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{value}%"


def order_by(sort: Optional[str], direction: str, allowed: dict[str, str], default: str) -> str:
    """
    Build a safe ORDER BY.  SQL cannot bind column names as parameters, so we
    only accept names from a whitelist (`allowed`). Anything else -> 400 error.
    This is what protects the app from SQL injection through ?sort=...
    """
    direction = (direction or "asc").lower()
    if direction not in ("asc", "desc"):
        raise HTTPException(400, "direction must be 'asc' or 'desc'")
    key = sort or default
    if key not in allowed:
        raise HTTPException(400, f"Cannot sort by '{key}'. Allowed: {', '.join(allowed)}")
    return f"{allowed[key]} {direction.upper()}"


def paginate(db: Connection, count_sql: str, data_sql: str, params: dict,
             page: int, limit: int) -> dict[str, Any]:
    """
    Server-side pagination: only `limit` rows are fetched from MySQL and sent
    to the browser. `data_sql` must NOT contain LIMIT - we add it here.
    """
    limit = max(1, min(limit, MAX_LIMIT))
    page = max(1, page)
    total = int(fetch_scalar(db, count_sql, params) or 0)
    items = fetch_all(db, f"{data_sql} LIMIT :_limit OFFSET :_offset",
                      {**params, "_limit": limit, "_offset": (page - 1) * limit})
    return {"items": items, "total": total, "page": page, "limit": limit,
            "pages": max(1, math.ceil(total / limit))}


def date_filters(column: str, date_from: Optional[date], date_to: Optional[date],
                 where: list[str], params: dict, prefix: str = "d") -> None:
    """Append `column >= from` / `column < to+1day` conditions (inclusive range)."""
    if date_from:
        where.append(f"{column} >= :{prefix}_from")
        params[f"{prefix}_from"] = date_from
    if date_to:
        where.append(f"{column} < DATE_ADD(:{prefix}_to, INTERVAL 1 DAY)")
        params[f"{prefix}_to"] = date_to


def where_sql(where: list[str]) -> str:
    return ("WHERE " + " AND ".join(where)) if where else ""
