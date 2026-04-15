"""Data Access Layer — all Neo4j catalog queries live here."""

from __future__ import annotations

from typing import Any

from server import neo4j_db


def list_databases() -> list[dict[str, Any]]:
    return neo4j_db.list_databases_with_counts()


def list_schemas_for_database(db_id: str) -> list[dict[str, Any]]:
    return neo4j_db.list_schemas_for_database(db_id)


def list_tables_for_schema(db_name: str, schema_name: str) -> list[dict[str, Any]]:
    return neo4j_db.list_tables_for_schema(db_name, schema_name)


def list_columns_for_table(
    db_name: str, schema_name: str, table_name: str
) -> list[dict[str, Any]] | None:
    return neo4j_db.list_columns_for_table(db_name, schema_name, table_name)
