"""Data Access Layer — Neo4j driver, catalog graph, and datasource queries."""

from __future__ import annotations

from typing import Any

from infra.Neo4jConnection import get_driver
from neo4j.exceptions import DriverError, Neo4jError

# Prefer graph property ``id`` (e.g. UUID from upstream sync); else Neo4j ``elementId``.
_MATCH_DB = "elementId(db) = $db_ref OR db.id = $db_ref OR db.name = $db_ref"
_MATCH_SCHEMA = (
    "elementId(s) = $schema_ref OR s.id = $schema_ref OR ("
    "$database_name IS NOT NULL AND s.database_name = $database_name AND s.name = $schema_ref) OR ("
    "$database_name IS NOT NULL AND s.name = $schema_ref AND EXISTS {"
    " MATCH (db:Database)-[:CONTAINS]->(s) "
    " WHERE db.name = $database_name OR db.id = $database_name})"
)
_PUBLIC_DB_ID = "coalesce(db.id, elementId(db))"
_PUBLIC_SCHEMA_ID = "coalesce(s.id, elementId(s))"
_PUBLIC_TABLE_ID = "coalesce(t.id, elementId(t))"
_PUBLIC_COLUMN_ID = "coalesce(c.id, elementId(c))"
_MATCH_TABLE = (
    "elementId(t) = $table_ref OR t.id = $table_ref OR ("
    "$database_name IS NOT NULL AND $schema_name IS NOT NULL "
    "AND t.database_name = $database_name AND t.schema_name = $schema_name "
    "AND t.name = $table_ref) OR ("
    "$database_name IS NOT NULL AND $schema_name IS NOT NULL AND t.name = $table_ref AND EXISTS {"
    " MATCH (db:Database)-[:CONTAINS]->(sch:Schema)-[:CONTAINS]->(t) "
    " WHERE (db.name = $database_name OR db.id = $database_name) AND sch.name = $schema_name})"
)

# ---------------------------------------------------------------------------
# Payload builders
# ---------------------------------------------------------------------------


def _column_payload(
    node_id: str,
    db_name: str,
    schema_name: str,
    table_name: str,
    col: dict[str, Any],
) -> dict[str, Any]:
    col_name: str = col["name"]
    return {
        "id": node_id,
        "name": col_name,
        "data_type": col.get("data_type") or "unknown",
        "database_name": db_name,
        "schema_name": schema_name,
        "table_name": table_name,
        "ordinal_position": col.get("ordinal_position") or 0,
    }


def _table_payload(
    node_id: str,
    db_name: str,
    schema_name: str,
    table_name: str,
    col_count: int,
    columns: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": node_id,
        "name": table_name,
        "description": "",
        "database_name": db_name,
        "schema_name": schema_name,
        "num_of_columns": col_count,
        "columns": columns,
    }


def _schema_payload(
    node_id: str,
    db_name: str,
    schema_name: str,
    tbl_count: int,
    tables: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": node_id,
        "name": schema_name,
        "database_name": db_name,
        "num_of_tables": tbl_count,
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
            f"""
            MATCH (db:Database)-[:CONTAINS]->(s:Schema)
            RETURN db.id as id, db.name as name, count(s) as schema_count
            ORDER BY name
            """,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [
        {
            "id": r["id"],
            "name": r["name"],
            "num_of_schemas": int(r["schema_count"]),
            "schemas": [],
        }
        for r in rows
    ]



def list_schemas_for_database(db_id: str) -> dict[str, Any] | None:
    """Return schemas_count and a list of schema summaries for a database.

    Returns a dict with ``schemas_count`` and ``schemas`` — a list of
    ``{id, schema_name, tables_count}`` dicts.

    Returns ``None`` if no ``Database`` matches ``db_id``.
    """
    driver = get_driver()
    try:
        rows, _, _ = driver.execute_query(
            """
            MATCH (db:Database {id: $db_id})-[:CONTAINS]->(s:Schema)-[:CONTAINS]->(t:Table)
            WITH s.id AS id, s.name AS schema_name, count(t) AS tables_count
            ORDER BY schema_name
            WITH collect({id: id, schema_name: schema_name, tables_count: tables_count}) AS schemas
            RETURN size(schemas) AS schemas_count, schemas
            """,
            db_id=db_id,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    if not rows:
        return None

    record = rows[0]
    return {
        "schemas_count": record["schemas_count"],
        "schemas": [dict(s) for s in record["schemas"]],
    }


def list_tables_for_schema(
    schema_id: str,
    *,
    database_name: str | None = None,
) -> list[dict[str, Any]]:
    """Return Table payloads with column counts for a given schema.

    Each table dict contains ``database_name``, ``schema_name``, ``name``,
    and ``columns_count``.
    """
    driver = get_driver()
    try:
        rows, _, _ = driver.execute_query(
            """
            MATCH (s:Schema {id: $schema_id})-[:CONTAINS]->(t:Table)-[:CONTAINS]->(c:Column)
            RETURN t.id AS id,
                   t.name AS name,
                   t.db_name AS db_name,
                   t.schema_name AS schema_name,
                   count(c) AS columns_count
            ORDER BY name
            """,
            schema_id=schema_id,
            database_name=database_name,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [dict(r) for r in rows]


def list_columns_for_table(table_id: str) -> dict[str, Any] | None:
    """Return a table dict with nested columns, or None if the table is missing.

    Returns ``table_name``, ``schema_name``, ``db_name`` (all from the Table
    node), ``columns_count``, and ``columns`` — a list of
    ``{ordinal_position, column_name, data_type}`` dicts.
    """
    driver = get_driver()
    try:
        rows, _, _ = driver.execute_query(
            """
            MATCH (t:Table {id: $table_id})-[:CONTAINS]->(c:Column)
            WITH t, c ORDER BY c.ordinal_position
            WITH t, collect({
                     ordinal_position: c.ordinal_position,
                     column_name: c.name,
                     data_type: c.data_type
                 }) AS columns
            RETURN t.name AS table_name,
                   t.schema_name AS schema_name,
                   t.db_name AS db_name,
                   size(columns) AS columns_count,
                   columns
            """,
            table_id=table_id,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    if not rows:
        return None

    return dict(rows[0])