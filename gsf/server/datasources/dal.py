"""Data Access Layer — Neo4j driver, catalog graph, and datasource queries."""

from __future__ import annotations

from typing import Any

from nemo_retriever.tabular_data.ingestion.model.reserved_words import Labels, RelTypes
from server.env import get_nemo_neo4j_conn

_LEGACY_REL_DB_TO_SCHEMA = "HAS_SCHEMA"
_LEGACY_REL_SCHEMA_TO_TABLE = "HAS_TABLE"
_LEGACY_REL_TABLE_TO_COLUMN = "HAS_COLUMN"


# ---------------------------------------------------------------------------
# Graph queries (public API for routers / services)
# ---------------------------------------------------------------------------


def list_databases() -> list[dict[str, Any]]:
    """Return Database rows with schema counts only; ``schemas`` is empty for lazy trees."""
    neo4j_conn = get_nemo_neo4j_conn()

    rows = neo4j_conn.query_read(
        f"""
        MATCH (db)-[r]->(s:{Labels.SCHEMA})
        WHERE db:{Labels.DB} OR db:Database
          AND type(r) IN ['{RelTypes.CONTAINS}', '{_LEGACY_REL_DB_TO_SCHEMA}']
        RETURN coalesce(db.id, db.name) as id, db.name as name, count(s) as schema_count
        ORDER BY name
        """,
    )

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
    neo4j_conn = get_nemo_neo4j_conn()
    rows = neo4j_conn.query_read(
        f"""
        MATCH (db)-[r1]->(s:{Labels.SCHEMA})-[r2]->(t:{Labels.TABLE})
        WHERE (db:{Labels.DB} OR db:Database)
          AND (db.id = $db_id OR db.name = $db_id)
          AND type(r1) IN ['{RelTypes.CONTAINS}', '{_LEGACY_REL_DB_TO_SCHEMA}']
          AND type(r2) IN ['{RelTypes.CONTAINS}', '{_LEGACY_REL_SCHEMA_TO_TABLE}']
        WITH coalesce(s.id, s.name) AS id, s.name AS schema_name, count(t) AS tables_count
        ORDER BY schema_name
        WITH collect({{id: id, schema_name: schema_name, tables_count: tables_count}}) AS schemas
        RETURN size(schemas) AS schemas_count, schemas
        """,
        {"db_id": db_id},
    )

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
    neo4j_conn = get_nemo_neo4j_conn()
    rows = neo4j_conn.query_read(
        f"""
        MATCH (s:{Labels.SCHEMA})-[r1]->(t:{Labels.TABLE})-[r2]->(c:{Labels.COLUMN})
        WHERE (s.id = $schema_id OR s.name = $schema_id)
          AND type(r1) IN ['{RelTypes.CONTAINS}', '{_LEGACY_REL_SCHEMA_TO_TABLE}']
          AND type(r2) IN ['{RelTypes.CONTAINS}', '{_LEGACY_REL_TABLE_TO_COLUMN}']
        RETURN coalesce(t.id, t.name) AS id,
               t.name AS name,
               t.db_name AS db_name,
               t.schema_name AS schema_name,
               count(c) AS columns_count
        ORDER BY name
        """,
        {
            "schema_id": schema_id,
            "database_name": database_name,
        },
    )

    return rows


def list_columns_for_table(table_id: str) -> dict[str, Any] | None:
    """Return a table dict with nested columns, or None if the table is missing.

    Returns ``table_name``, ``schema_name``, ``db_name`` (all from the Table
    node), ``columns_count``, and ``columns`` — a list of
    ``{ordinal_position, column_name, data_type}`` dicts.
    """
    neo4j_conn = get_nemo_neo4j_conn()
    rows = neo4j_conn.query_read(
        f"""
        MATCH (t:{Labels.TABLE})-[r]->(c:{Labels.COLUMN})
        WHERE (t.id = $table_id OR t.name = $table_id)
          AND type(r) IN ['{RelTypes.CONTAINS}', '{_LEGACY_REL_TABLE_TO_COLUMN}']
        WITH t, c ORDER BY c.ordinal_position
        WITH t, collect({{
                 ordinal_position: c.ordinal_position,
                 column_name: c.name,
                 data_type: c.data_type
             }}) AS columns
        RETURN t.name AS table_name,
               t.schema_name AS schema_name,
               t.db_name AS db_name,
               size(columns) AS columns_count,
               columns
        """,
        {"table_id": table_id},
    )

    return rows[0]
