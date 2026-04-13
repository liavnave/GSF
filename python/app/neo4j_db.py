from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError

_app_dir = Path(__file__).resolve().parent
_server_dir = _app_dir.parent
_repo_root = _server_dir.parent

_driver = None

# Neo4j database that stores the catalog graph (not the system database).
CATALOG_DB = "neo4j"


def _load_env() -> None:
    # Call on each connect attempt so values are not frozen from a failed first import.
    load_dotenv(_repo_root / ".env", override=True)
    load_dotenv(_server_dir / ".env", override=True)


def _neo4j_config() -> tuple[str, str, str]:
    _load_env()
    uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687").strip()
    user = os.environ.get("NEO4J_USERNAME", "neo4j").strip()
    password = os.environ.get("NEO4J_PASSWORD", "").strip()
    return uri, user, password


def get_driver():
    global _driver
    uri, user, password = _neo4j_config()
    if not password:
        root_env = _repo_root / ".env"
        server_env = _server_dir / ".env"
        msg = (
            "NEO4J_PASSWORD is not set after loading .env. "
            f"Looked for {root_env} (exists={root_env.is_file()}), "
            f"{server_env} (exists={server_env.is_file()}). "
            "Add NEO4J_PASSWORD there or export it before starting uvicorn."
        )
        raise RuntimeError(msg)
    if _driver is None:
        _driver = GraphDatabase.driver(uri, auth=(user, password))
    return _driver


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def list_database_names() -> list[str]:
    driver = get_driver()
    try:
        with driver.session(database="system") as session:
            result = session.run(
                "SHOW DATABASES YIELD name RETURN name ORDER BY name",
            )
            return [record["name"] for record in result]
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e


def _iso_utc_z() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")


# ---------------------------------------------------------------------------
# ID helpers
# ---------------------------------------------------------------------------


def schema_id(db_name: str, schema_name: str) -> str:
    return f"{db_name}|{schema_name}"


def table_id(db_name: str, schema_name: str, table_name: str) -> str:
    return f"{db_name}|{schema_name}|{table_name}"


def column_id(db_name: str, schema_name: str, table_name: str, col_name: str) -> str:
    return f"{db_name}|{schema_name}|{table_name}|{col_name}"


def parse_schema_id(sid: str) -> tuple[str, str] | None:
    parts = sid.split("|", 1)
    return (parts[0], parts[1]) if len(parts) == 2 else None  # noqa: PLR2004


def parse_table_id(tid: str) -> tuple[str, str, str] | None:
    parts = tid.split("|", 2)
    return (parts[0], parts[1], parts[2]) if len(parts) == 3 else None  # noqa: PLR2004


def parse_column_id(cid: str) -> tuple[str, str, str, str] | None:
    parts = cid.split("|", 3)
    return (parts[0], parts[1], parts[2], parts[3]) if len(parts) == 4 else None  # noqa: PLR2004


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
# Graph queries
# ---------------------------------------------------------------------------


def list_databases_as_datasource_payload() -> list[dict[str, Any]]:
    """Return Database → Schema → Table tree.

    Columns are NOT included here — they are loaded lazily per table via
    ``get_table_by_id``.  Each table carries the real ``num_of_columns`` count
    so the client knows whether the table is expandable.
    """
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
                """
                MATCH (db:Database)-[:HAS_SCHEMA]->(s:Schema)-[:HAS_TABLE]->(t:Table)
                OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
                WITH db.name AS db_name, s.name AS schema_name,
                     t.name AS table_name, count(c) AS col_count
                RETURN db_name, schema_name, table_name, col_count
                ORDER BY schema_name, table_name
                """
            )
            rows = list(result)
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    dbs: dict[str, dict[str, Any]] = {}
    schemas: dict[str, dict[str, dict[str, Any]]] = {}

    for row in rows:
        db_name: str = row["db_name"]
        s_name: str = row["schema_name"]
        t_name: str = row["table_name"]
        col_count: int = row["col_count"]

        if db_name not in dbs:
            dbs[db_name] = {
                "id": db_name,
                "name": db_name,
                "schemas": [],
            }
            schemas[db_name] = {}

        if s_name not in schemas[db_name]:
            schema = _schema_payload(db_name, s_name, [])
            schemas[db_name][s_name] = schema
            dbs[db_name]["schemas"].append(schema)

        # Tables have empty columns list; num_of_columns reflects the real count.
        tbl = _table_payload(db_name, s_name, t_name, [])
        tbl["num_of_columns"] = col_count
        schemas[db_name][s_name]["tables"].append(tbl)
        schemas[db_name][s_name]["num_of_tables"] += 1

    return list(dbs.values())


def list_schemas_for_database(db_name: str) -> list[dict[str, Any]]:
    """Return Schema payloads (with tables and columns) for a given database."""
    full = list_databases_as_datasource_payload()
    for db in full:
        if db["id"] == db_name:
            return db["schemas"]
    return []


def list_tables_for_database(db_name: str) -> list[dict[str, Any]]:
    """Return flat list of Table payloads (columns stripped) for a given database."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
                """
                MATCH (:Database {name: $db_name})-[:HAS_SCHEMA]->(s:Schema)
                      -[:HAS_TABLE]->(t:Table)
                OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
                WITH s.name AS schema_name, t.name AS table_name, count(c) AS col_count
                RETURN schema_name, table_name, col_count
                ORDER BY schema_name, table_name
                """,
                db_name=db_name,
            )
            rows = list(result)
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    return [
        _table_payload(db_name, r["schema_name"], r["table_name"], [])
        | {"num_of_columns": r["col_count"]}
        for r in rows
    ]


def list_tables_for_schema(db_name: str, s_name: str) -> list[dict[str, Any]]:
    """Return flat list of Table payloads (columns stripped) for a given schema."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
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
            )
            rows = list(result)
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    return [
        _table_payload(db_name, s_name, r["table_name"], [])
        | {"num_of_columns": r["col_count"]}
        for r in rows
    ]


def list_all_schemas() -> list[dict[str, Any]]:
    """Return all Schema payloads (tables stripped) with a `db` NameId field."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
                """
                MATCH (db:Database)-[:HAS_SCHEMA]->(s:Schema)
                OPTIONAL MATCH (s)-[:HAS_TABLE]->(t:Table)
                WITH db.name AS db_name, s.name AS schema_name, count(t) AS tbl_count
                RETURN db_name, schema_name, tbl_count
                ORDER BY db_name, schema_name
                """
            )
            rows = list(result)
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    out = []
    for r in rows:
        db_name: str = r["db_name"]
        s_name: str = r["schema_name"]
        payload = _schema_payload(db_name, s_name, [])
        payload["num_of_tables"] = r["tbl_count"]
        payload["db"] = {"id": db_name, "name": db_name}
        out.append(payload)
    return out


def list_columns_for_schema(db_name: str, s_name: str) -> list[dict[str, Any]]:
    """Return flat list of Column payloads for a given schema."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
                """
                MATCH (:Schema {database_name: $db_name, name: $schema_name})
                      -[:HAS_TABLE]->(t:Table)-[:HAS_COLUMN]->(c:Column)
                RETURN t.name AS table_name, c.name AS col_name,
                       c.data_type AS data_type, c.ordinal_position AS ordinal_position
                ORDER BY t.name, c.ordinal_position
                """,
                db_name=db_name,
                schema_name=s_name,
            )
            rows = list(result)
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    return [
        _column_payload(
            db_name,
            s_name,
            r["table_name"],
            {
                "name": r["col_name"],
                "data_type": r["data_type"],
                "ordinal_position": r["ordinal_position"],
            },
        )
        for r in rows
    ]


def list_columns_for_database(db_name: str) -> list[dict[str, Any]]:
    """Return flat list of Column payloads for a given database."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
                """
                MATCH (:Database {name: $db_name})-[:HAS_SCHEMA]->(s:Schema)
                      -[:HAS_TABLE]->(t:Table)-[:HAS_COLUMN]->(c:Column)
                RETURN s.name AS schema_name, t.name AS table_name,
                       c.name AS col_name, c.data_type AS data_type,
                       c.ordinal_position AS ordinal_position
                ORDER BY s.name, t.name, c.ordinal_position
                """,
                db_name=db_name,
            )
            rows = list(result)
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    return [
        _column_payload(
            db_name,
            r["schema_name"],
            r["table_name"],
            {
                "name": r["col_name"],
                "data_type": r["data_type"],
                "ordinal_position": r["ordinal_position"],
            },
        )
        for r in rows
    ]


def get_table_by_id(db_name: str, s_name: str, t_name: str) -> dict[str, Any] | None:
    """Return a single Table payload with columns, or None if not found."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
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
            )
            col_rows = list(result)
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    # Verify table exists (col_rows empty could mean table has no columns).
    driver2 = get_driver()
    try:
        with driver2.session(database=CATALOG_DB) as session:
            exists = session.run(
                "MATCH (t:Table {database_name: $db_name, schema_name: $schema_name,"
                " name: $table_name}) RETURN t LIMIT 1",
                db_name=db_name,
                schema_name=s_name,
                table_name=t_name,
            ).single()
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    if exists is None:
        return None

    columns = [
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
    return _table_payload(db_name, s_name, t_name, columns)


def get_column_by_id(
    db_name: str, s_name: str, t_name: str, col_name: str
) -> dict[str, Any] | None:
    """Return a single Column payload, or None if not found."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            row = session.run(
                """
                MATCH (:Table {database_name: $db_name, schema_name: $schema_name,
                               name: $table_name})-[:HAS_COLUMN]->
                      (c:Column {name: $col_name})
                RETURN c.data_type AS data_type, c.ordinal_position AS ordinal_position
                """,
                db_name=db_name,
                schema_name=s_name,
                table_name=t_name,
                col_name=col_name,
            ).single()
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e

    if row is None:
        return None

    return _column_payload(
        db_name,
        s_name,
        t_name,
        {
            "name": col_name,
            "data_type": row["data_type"],
            "ordinal_position": row["ordinal_position"],
        },
    )
