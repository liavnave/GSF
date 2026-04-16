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
            MATCH (db:Database)
            WITH db, db.name AS dname
            OPTIONAL MATCH (db)-[:HAS_SCHEMA]-(s_r:Schema)
            WITH db, dname, collect(DISTINCT s_r) AS c1
            OPTIONAL MATCH (db)-[:CONTAINS]->(s_k:Schema)
            WITH db, dname, c1, collect(DISTINCT s_k) AS c1b
            OPTIONAL MATCH (s2:Schema)
            WHERE s2.database_name = dname OR coalesce(s2.database, '') = dname
            WITH db, dname, c1, c1b, collect(DISTINCT s2) AS c2
            WITH db, [x IN c1 WHERE x IS NOT NULL] + [x IN c1b WHERE x IS NOT NULL]
                 + [x IN c2 WHERE x IS NOT NULL] AS combined
            UNWIND CASE WHEN size(combined) = 0 THEN [null] ELSE combined END AS u
            WITH db, collect(DISTINCT u) AS all_u
            WITH db, size([x IN all_u WHERE x IS NOT NULL]) AS schema_count
            RETURN {_PUBLIC_DB_ID} AS id, db.name AS name, schema_count
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


def _merge_schema_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate by stable node key; prefer rows that already have ``database_name``."""
    by_eid: dict[str, dict[str, Any]] = {}
    for r in rows:
        eid = str(r.pop("_eid", ""))
        if not eid:
            continue
        if eid not in by_eid:
            by_eid[eid] = r
    return sorted(by_eid.values(), key=lambda x: str(x["name"]))


def list_schemas_for_database(db_ref: str) -> list[dict[str, Any]] | None:
    """Return Schema payloads with table counts; ``tables`` is empty until expanded.

    ``db_ref`` may be the Database node's element id, property ``id``, or ``name``.

    Schemas are collected by: (1) ``HAS_SCHEMA`` or ``CONTAINS`` from that
    ``Database``, and (2) ``Schema.database_name`` (or ``Schema.database``)
    equal to the database's ``name``. Results are merged in Python so one path
    cannot wipe the other (avoids brittle ``OPTIONAL MATCH`` + ``IN`` patterns).

    Returns ``None`` if no ``Database`` matches. Returns ``[]`` if none qualify.
    """
    driver = get_driver()
    try:
        meta, _, _ = driver.execute_query(
            f"""
            MATCH (db:Database)
            WHERE {_MATCH_DB}
            RETURN db.name AS database_name, elementId(db) AS db_eid
            LIMIT 1
            """,
            db_ref=db_ref,
            database_="neo4j",
        )
        if not meta:
            return None
        database_name = meta[0]["database_name"]
        db_eid = meta[0]["db_eid"]

        rel_rows, _, _ = driver.execute_query(
            f"""
            MATCH (db:Database)
            WHERE elementId(db) = $db_eid
            OPTIONAL MATCH (db)-[:HAS_SCHEMA]-(s_h:Schema)
            OPTIONAL MATCH (db)-[:CONTAINS]->(s_c:Schema)
            WITH $database_name AS database_name,
                 [x IN collect(DISTINCT s_h) WHERE x IS NOT NULL]
                 + [y IN collect(DISTINCT s_c) WHERE y IS NOT NULL] AS slist
            UNWIND slist AS s
            WITH DISTINCT s, database_name
            OPTIONAL MATCH (s)-[:HAS_TABLE|CONTAINS]->(t:Table)
            WITH s, database_name, count(DISTINCT t) AS tbl_count
            RETURN {_PUBLIC_SCHEMA_ID} AS id, s.name AS name, database_name, tbl_count,
                   elementId(s) AS _eid
            ORDER BY name
            """,
            db_eid=db_eid,
            database_name=database_name,
            database_="neo4j",
        )

        prop_rows, _, _ = driver.execute_query(
            f"""
            MATCH (s:Schema)
            WHERE s.database_name = $database_name
               OR coalesce(s.database, '') = $database_name
            OPTIONAL MATCH (s)-[:HAS_TABLE|CONTAINS]->(t:Table)
            WITH s, $database_name AS database_name, count(DISTINCT t) AS tbl_count
            RETURN {_PUBLIC_SCHEMA_ID} AS id, s.name AS name, database_name, tbl_count,
                   elementId(s) AS _eid
            ORDER BY name
            """,
            database_name=database_name,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    combined = [dict(r) for r in rel_rows] + [dict(r) for r in prop_rows]
    merged = _merge_schema_rows(combined)
    return [
        _schema_payload(
            r["id"],
            r["database_name"],
            r["name"],
            int(r["tbl_count"]),
            [],
        )
        for r in merged
    ]


def list_tables_for_schema(
    schema_ref: str,
    *,
    database_name: str | None = None,
) -> list[dict[str, Any]]:
    """Return flat list of Table payloads (columns stripped) for a given schema.

    ``schema_ref`` is the Schema node's element id, or its ``name`` if
    ``database_name`` is the parent database name (name-based path).
    """
    driver = get_driver()
    try:
        rows, _, _ = driver.execute_query(
            f"""
            MATCH (s:Schema)
            WHERE {_MATCH_SCHEMA}
            OPTIONAL MATCH (db:Database)-[:CONTAINS]->(s)
            MATCH (s)-[:HAS_TABLE|CONTAINS]->(t:Table)
            OPTIONAL MATCH (t)-[:HAS_COLUMN|CONTAINS]->(c:Column)
            WITH t, coalesce(s.database_name, s.database, db.name) AS database_name,
                 s.name AS schema_name, count(c) AS col_count
            RETURN {_PUBLIC_TABLE_ID} AS id, t.name AS name, database_name, schema_name, col_count
            ORDER BY name
            """,
            schema_ref=schema_ref,
            database_name=database_name,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [
        _table_payload(
            r["id"],
            r["database_name"],
            r["schema_name"],
            r["name"],
            int(r["col_count"]),
            [],
        )
        for r in rows
    ]


def list_columns_for_table(
    table_ref: str,
    *,
    database_name: str | None = None,
    schema_name: str | None = None,
) -> list[dict[str, Any]] | None:
    """Return Column payloads for one table, or None if the table node is missing.

    ``table_ref`` is the Table node's element id, or its ``name`` together with
    ``database_name`` and ``schema_name``.
    """
    driver = get_driver()
    table_where = _MATCH_TABLE
    try:
        exists, _, _ = driver.execute_query(
            f"MATCH (t:Table) WHERE {table_where} RETURN t LIMIT 1",
            table_ref=table_ref,
            database_name=database_name,
            schema_name=schema_name,
            database_="neo4j",
        )
        if not exists:
            return None
        meta, _, _ = driver.execute_query(
            f"""
            MATCH (t:Table)
            WHERE {table_where}
            OPTIONAL MATCH (db:Database)-[:CONTAINS]->(sch:Schema)-[:CONTAINS]->(t)
            RETURN coalesce(t.database_name, db.name) AS database_name,
                   coalesce(t.schema_name, sch.name) AS schema_name, t.name AS table_name
            LIMIT 1
            """,
            table_ref=table_ref,
            database_name=database_name,
            schema_name=schema_name,
            database_="neo4j",
        )
        if not meta:
            return None
        m0 = meta[0]
        db_name = m0["database_name"]
        s_name = m0["schema_name"]
        t_name = m0["table_name"]
        col_rows, _, _ = driver.execute_query(
            f"""
            MATCH (t:Table)
            WHERE {table_where}
            MATCH (t)-[:HAS_COLUMN|CONTAINS]->(c:Column)
            RETURN {_PUBLIC_COLUMN_ID} AS id, c.name AS col_name, c.data_type AS data_type,
                   c.ordinal_position AS ordinal_position
            ORDER BY c.ordinal_position
            """,
            table_ref=table_ref,
            database_name=database_name,
            schema_name=schema_name,
            database_="neo4j",
        )
    except (DriverError, Neo4jError) as e:
        raise RuntimeError(str(e)) from e

    return [
        _column_payload(
            r["id"],
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
