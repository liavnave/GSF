"""Data Access Layer — all Neo4j catalog queries live here."""

from __future__ import annotations

from typing import Any

from server import neo4j_db


# ---------------------------------------------------------------------------
# ID helpers
# ---------------------------------------------------------------------------


def parse_schema_id(sid: str) -> tuple[str, str] | None:
    return neo4j_db.parse_schema_id(sid)


def parse_table_id(tid: str) -> tuple[str, str, str] | None:
    return neo4j_db.parse_table_id(tid)


def parse_column_id(cid: str) -> tuple[str, str, str, str] | None:
    return neo4j_db.parse_column_id(cid)


# ---------------------------------------------------------------------------
# Datasource queries
# ---------------------------------------------------------------------------


def list_databases() -> list[dict[str, Any]]:
    return neo4j_db.list_databases_as_datasource_payload()


def list_schemas_for_database(db_id: str) -> list[dict[str, Any]]:
    return neo4j_db.list_schemas_for_database(db_id)


def list_tables_for_database(db_id: str) -> list[dict[str, Any]]:
    return neo4j_db.list_tables_for_database(db_id)


def list_columns_for_database(db_id: str) -> list[dict[str, Any]]:
    return neo4j_db.list_columns_for_database(db_id)


def list_all_schemas() -> list[dict[str, Any]]:
    return neo4j_db.list_all_schemas()


def list_tables_for_schema(db_name: str, schema_name: str) -> list[dict[str, Any]]:
    return neo4j_db.list_tables_for_schema(db_name, schema_name)


def list_columns_for_schema(db_name: str, schema_name: str) -> list[dict[str, Any]]:
    return neo4j_db.list_columns_for_schema(db_name, schema_name)


def get_table(db_name: str, schema_name: str, table_name: str) -> dict[str, Any] | None:
    return neo4j_db.get_table_by_id(db_name, schema_name, table_name)


def get_column(
    db_name: str, schema_name: str, table_name: str, col_name: str
) -> dict[str, Any] | None:
    return neo4j_db.get_column_by_id(db_name, schema_name, table_name, col_name)
