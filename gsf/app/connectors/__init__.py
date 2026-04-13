from __future__ import annotations

from app.connectors._nemo_import import get_sql_database_class
from app.connectors.postgres import PostgresDatabase

SQLDatabase = get_sql_database_class()

__all__ = ["SQLDatabase", "PostgresDatabase"]
