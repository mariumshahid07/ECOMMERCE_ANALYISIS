"""
config.py - reads the database settings from the .env file.

The password is NEVER written in Python code. It lives in `.env`,
which is listed in .gitignore so it is not uploaded to GitHub.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# project root = the folder that contains `backend/` and `.env`
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "olist_ecommerce")


settings = Settings()
