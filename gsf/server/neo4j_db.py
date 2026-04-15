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


def list_databases_with_counts() -> list[dict[str, Any]]:
    """Return Database rows with schema counts only; ``schemas`` is empty for lazy trees."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
                """
                MATCH (db:Database)
                OPTIONAL MATCH (db)-[:HAS_SCHEMA]->(s:Schema)
                WITH db.name AS db_name, count(s) AS schema_count
                RETURN db_name, schema_count
                ORDER BY db_name
                """
            )
            rows = list(result)
    except Neo4jError as e:
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
        with driver.session(database=CATALOG_DB) as session:
            result = session.run(
                """
                MATCH (:Database {name: $db_name})-[:HAS_SCHEMA]->(s:Schema)
                OPTIONAL MATCH (s)-[:HAS_TABLE]->(t:Table)
                WITH s.name AS schema_name, count(t) AS tbl_count
                RETURN schema_name, tbl_count
                ORDER BY schema_name
                """,
                db_name=db_name,
            )
            rows = list(result)
    except Neo4jError as e:
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


def list_columns_for_table(
    db_name: str, s_name: str, t_name: str
) -> list[dict[str, Any]] | None:
    """Return Column payloads for one table, or None if the table node is missing."""
    driver = get_driver()
    try:
        with driver.session(database=CATALOG_DB) as session:
            exists = session.run(
                "MATCH (t:Table {database_name: $db_name, schema_name: $schema_name,"
                " name: $table_name}) RETURN t LIMIT 1",
                db_name=db_name,
                schema_name=s_name,
                table_name=t_name,
            ).single()
            if exists is None:
                return None
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
