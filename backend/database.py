"""
database.py - one reusable connection pool for the whole app.

* `engine`  : the SQLAlchemy engine (manages a pool of MySQL connections).
* `get_db`  : a FastAPI *dependency*. Every API function that writes
              `db: Connection = Depends(get_db)` gets its own connection,
              and it is closed automatically when the request finishes.
"""
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Connection

from .config import settings

# URL.create() safely handles special characters (@ : / #) in the password.
DATABASE_URL = URL.create(
    drivername="mysql+pymysql",
    username=settings.DB_USER,
    password=settings.DB_PASSWORD,
    host=settings.DB_HOST,
    port=settings.DB_PORT,
    database=settings.DB_NAME,
    query={"charset": "utf8mb4"},
)

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,   # test a connection before using it (avoids "MySQL has gone away")
    pool_recycle=1800,
)


def get_db() -> Iterator[Connection]:
    with engine.connect() as conn:
        yield conn
