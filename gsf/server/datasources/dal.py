"""Data Access Layer — Neo4j driver, catalog graph, and datasource queries."""

from __future__ import annotations

from typing import Any

from infra.Neo4jConnection import get_driver
from neo4j.exceptions import DriverError, Neo4jError

# ---------------------------------------------------------------------------
# ID helpers
# ---------------------------------------------------------------------------


def schema_id(db_name: str, schema_name: str) -> str:
    return f"{db_name}|{schema_name}"


def table_id(db_name: str, schema_name: str, table_name: str) -> str:
    return f"{db_name}|{schema_name}|{table_name}"


def column_id(db_name: str, schema_name: str, table_name: str, col_name: str) -> str:
    return f"{db_name}|{schema_name}|{table_name}|{col_name}"


# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------


def _column_payload(
    db_name: str, schema_name: str, table_name: str, col: dict[str, Any]
) -> dict[str, Any]:
    col_name: str = col["name"]
    return {
        "id": column_id(db_name, schema_name, table_name, col_name),
        "name": col_name,
        "data_type": col.get("data_type") or "unknown",
        "database_name": db_name,
        "schema_name": schema_name,
        "table_name": table_name,
        "ordinal_position": col.get("ordinal_position") or 0,
    }


def _table_payload(
    db_name: str, schema_name: str, table_name: str, columns: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": table_id(db_name, schema_name, table_name),
        "name": table_name,
        "description": "",
        "database_name": db_name,
        "schema_name": schema_name,
        "num_of_columns": len(columns),
        "columns": columns,
    }


def _schema_payload(
    db_name: str, schema_name: str, tables: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "id": schema_id(db_name, schema_name),
        "name": schema_name,
        "database_name": db_name,
        "num_of_tables": len(tables),
        "tables": tables,
    }


# ---------------------------------------------------------------------------
# Graph queries (public API for routers / services)
# ---------------------------------------------------------------------------


def list_databases() -> list[dict[str, Any]]:
    """Return Database rows with schema counts only; ``schemas`` is empty for lazy trees."""
    driver = get_driver()
    try:
        # Default routing is WRITE — same practical behavior as Session.run() on
        # bolt://; READ routing can fail on standalone instances.
        rows, _, _ = driver.execute_query(
            """
            MATCH (db:Database)
            OPTIONAL MATCH (db)-[:HAS_SCHEMA]->(s:Schema)
            WITH db.name AS db_name, count(s) AS schema_count
            RETURN db_name, schema_count
            ORDER BY db_name
            """,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [
        {
            "id": r["db_name"],
            "name": r["db_name"],
            "num_of_schemas": int(r["schema_count"]),
            "schemas": [],
        }
        for r in rows
    ]


def list_schemas_for_database(db_name: str) -> list[dict[str, Any]]:
    """Return Schema payloads with table counts; ``tables`` is empty until expanded."""
    driver = get_driver()
    try:
        rows, _, _ = driver.execute_query(
            """
            MATCH (:Database {name: $db_name})-[:HAS_SCHEMA]->(s:Schema)
            OPTIONAL MATCH (s)-[:HAS_TABLE]->(t:Table)
            WITH s.name AS schema_name, count(t) AS tbl_count
            RETURN schema_name, tbl_count
            ORDER BY schema_name
            """,
            db_name=db_name,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [
        _schema_payload(db_name, r["schema_name"], [])
        | {"num_of_tables": int(r["tbl_count"])}
        for r in rows
    ]


def list_tables_for_schema(db_name: str, s_name: str) -> list[dict[str, Any]]:
    """Return flat list of Table payloads (columns stripped) for a given schema."""
    driver = get_driver()
    try:
        rows, _, _ = driver.execute_query(
            """
            MATCH (:Schema {database_name: $db_name, name: $schema_name})
                  -[:HAS_TABLE]->(t:Table)
            OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
            WITH t.name AS table_name, count(c) AS col_count
            RETURN table_name, col_count
            ORDER BY table_name
            """,
            db_name=db_name,
            schema_name=s_name,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [
        _table_payload(db_name, s_name, r["table_name"], [])
        | {"num_of_columns": r["col_count"]}
        for r in rows
    ]


def list_columns_for_table(
    db_name: str, s_name: str, t_name: str
) -> list[dict[str, Any]] | None:
    """Return Column payloads for one table, or None if the table node is missing."""
    driver = get_driver()
    try:
        exists, _, _ = driver.execute_query(
            "MATCH (t:Table {database_name: $db_name, schema_name: $schema_name,"
            " name: $table_name}) RETURN t LIMIT 1",
            db_name=db_name,
            schema_name=s_name,
            table_name=t_name,
            database_="neo4j",
        )
        if not exists:
            return None
        col_rows, _, _ = driver.execute_query(
            """
            MATCH (:Table {database_name: $db_name, schema_name: $schema_name,
                           name: $table_name})-[:HAS_COLUMN]->(c:Column)
            RETURN c.name AS col_name, c.data_type AS data_type,
                   c.ordinal_position AS ordinal_position
            ORDER BY c.ordinal_position
            """,
            db_name=db_name,
            schema_name=s_name,
            table_name=t_name,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [
        _column_payload(
            db_name,
            s_name,
            t_name,
            {
                "name": r["col_name"],
                "data_type": r["data_type"],
                "ordinal_position": r["ordinal_position"],
            },
        )
        for r in col_rows
    ]
