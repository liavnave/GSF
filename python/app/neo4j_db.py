from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError

_app_dir = Path(__file__).resolve().parent
_python_dir = _app_dir.parent
_repo_root = _python_dir.parent

_driver = None


def _load_env() -> None:
    load_dotenv(_repo_root / ".env", override=True)
    load_dotenv(_python_dir / ".env", override=True)


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
        python_env = _python_dir / ".env"
        msg = (
            "NEO4J_PASSWORD is not set after loading .env. "
            f"Looked for {root_env} (exists={root_env.is_file()}), "
            f"{python_env} (exists={python_env.is_file()}). "
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


def _node_to_dict(record, key: str = "n") -> dict[str, Any]:
    return dict(record[key])


# ---------------------------------------------------------------------------
# Databases
# ---------------------------------------------------------------------------

def list_databases() -> list[dict[str, Any]]:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database)
            OPTIONAL MATCH (d)-[:HAS_SCHEMA]->(s:Schema)
            OPTIONAL MATCH (s)-[:HAS_TABLE]->(t:Table)
            OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
            WITH d, s, t, collect(properties(c)) AS columns
            WITH d, s, collect({
                id: t.id, name: t.name, description: t.description,
                last_queried: t.last_queried, num_of_columns: t.num_of_columns,
                num_of_queries: t.num_of_queries, num_of_terms: t.num_of_terms,
                num_of_dup: t.num_of_dup, num_of_filters: t.num_of_filters,
                num_of_joins: t.num_of_joins, num_of_aggregations: t.num_of_aggregations,
                type: t.type, label: t.label, owner_id: t.owner_id,
                row_count: t.row_count, num_of_usage: t.num_of_usage, usage: t.usage,
                db: {id: d.id, name: d.name}, schema: {id: s.id, name: s.name},
                tags: [], columns: columns, related_terms: []
            }) AS tables
            WITH d, collect(CASE WHEN s.id IS NOT NULL THEN {
                id: s.id, name: s.name, added: s.added, description: s.description,
                num_of_tables: s.num_of_tables, type: s.type, owner_id: s.owner_id,
                tags: [], tables: tables
            } ELSE NULL END) AS schemas
            RETURN d, [s IN schemas WHERE s IS NOT NULL] AS schemas
            ORDER BY d.name
            """
        )
        databases = []
        for record in result:
            d = dict(record["d"])
            d["schemas"] = record["schemas"]
            databases.append(d)
        return databases


def db_by_id(db_id: str) -> dict[str, Any] | None:
    dbs = list_databases()
    for d in dbs:
        if d["id"] == db_id:
            return d
    return None


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

def all_schemas_with_db() -> list[dict[str, Any]]:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database)-[:HAS_SCHEMA]->(s:Schema)
            OPTIONAL MATCH (s)-[:HAS_TABLE]->(t:Table)
            WITH d, s, collect({
                id: t.id, name: t.name, description: t.description,
                last_queried: t.last_queried, num_of_columns: t.num_of_columns,
                num_of_queries: t.num_of_queries, type: t.type, label: t.label,
                db: {id: d.id, name: d.name}, schema: {id: s.id, name: s.name},
                tags: [], columns: []
            }) AS tables
            RETURN s, {id: d.id, name: d.name} AS db, tables
            ORDER BY d.name, s.name
            """
        )
        schemas = []
        for record in result:
            s = dict(record["s"])
            s["db"] = record["db"]
            s["tables"] = record["tables"]
            s["tags"] = s.get("tags", [])
            schemas.append(s)
        return schemas


def schemas_for_database(db_id: str) -> list[dict[str, Any]]:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database {id: $db_id})-[:HAS_SCHEMA]->(s:Schema)
            OPTIONAL MATCH (s)-[:HAS_TABLE]->(t:Table)
            WITH d, s, collect({
                id: t.id, name: t.name, description: t.description,
                last_queried: t.last_queried, num_of_columns: t.num_of_columns,
                num_of_queries: t.num_of_queries, type: t.type, label: t.label,
                db: {id: d.id, name: d.name}, schema: {id: s.id, name: s.name},
                tags: [], columns: []
            }) AS tables
            RETURN s, tables
            ORDER BY s.name
            """,
            db_id=db_id,
        )
        schemas = []
        for record in result:
            s = dict(record["s"])
            s["tables"] = record["tables"]
            s["tags"] = s.get("tags", [])
            schemas.append(s)
        return schemas


def schema_exists(schema_id: str) -> bool:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            "MATCH (s:Schema {id: $id}) RETURN count(s) AS c", id=schema_id
        )
        return result.single()["c"] > 0


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

def tables_for_database(db_id: str) -> list[dict[str, Any]]:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database {id: $db_id})-[:HAS_SCHEMA]->(s:Schema)-[:HAS_TABLE]->(t:Table)
            RETURN t, {id: d.id, name: d.name} AS db, {id: s.id, name: s.name} AS schema
            ORDER BY s.name, t.name
            """,
            db_id=db_id,
        )
        tables = []
        for record in result:
            t = dict(record["t"])
            t["db"] = record["db"]
            t["schema"] = record["schema"]
            t["tags"] = []
            t["columns"] = []
            t["related_terms"] = []
            tables.append(t)
        return tables


def tables_for_schema(schema_id: str) -> list[dict[str, Any]]:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database)-[:HAS_SCHEMA]->(s:Schema {id: $schema_id})-[:HAS_TABLE]->(t:Table)
            RETURN t, {id: d.id, name: d.name} AS db, {id: s.id, name: s.name} AS schema
            ORDER BY t.name
            """,
            schema_id=schema_id,
        )
        tables = []
        for record in result:
            t = dict(record["t"])
            t["db"] = record["db"]
            t["schema"] = record["schema"]
            t["tags"] = []
            t["columns"] = []
            t["related_terms"] = []
            tables.append(t)
        return tables


def table_by_id(table_id: str) -> dict[str, Any] | None:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database)-[:HAS_SCHEMA]->(s:Schema)-[:HAS_TABLE]->(t:Table {id: $id})
            OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
            WITH d, s, t, collect(properties(c)) AS columns
            RETURN t, {id: d.id, name: d.name} AS db, {id: s.id, name: s.name} AS schema, columns
            """,
            id=table_id,
        )
        record = result.single()
        if record is None:
            return None
        t = dict(record["t"])
        t["db"] = record["db"]
        t["schema"] = record["schema"]
        t["tags"] = []
        t["columns"] = record["columns"]
        t["related_terms"] = []
        return t


# ---------------------------------------------------------------------------
# Columns
# ---------------------------------------------------------------------------

def columns_for_database(db_id: str) -> list[dict[str, Any]]:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database {id: $db_id})-[:HAS_SCHEMA]->(s:Schema)-[:HAS_TABLE]->(t:Table)-[:HAS_COLUMN]->(c:Column)
            OPTIONAL MATCH (c)-[:HAS_FILL]->(f:Fill)
            WITH d, s, t, c, collect(properties(f)) AS fills
            RETURN c, {id: d.id, name: d.name} AS db, {id: s.id, name: s.name} AS schema,
                   {id: t.id, name: t.name} AS table, fills
            ORDER BY s.name, t.name, c.name
            """,
            db_id=db_id,
        )
        return [_build_column(record) for record in result]


def columns_for_schema(schema_id: str) -> list[dict[str, Any]]:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database)-[:HAS_SCHEMA]->(s:Schema {id: $schema_id})-[:HAS_TABLE]->(t:Table)-[:HAS_COLUMN]->(c:Column)
            OPTIONAL MATCH (c)-[:HAS_FILL]->(f:Fill)
            WITH d, s, t, c, collect(properties(f)) AS fills
            RETURN c, {id: d.id, name: d.name} AS db, {id: s.id, name: s.name} AS schema,
                   {id: t.id, name: t.name} AS table, fills
            ORDER BY t.name, c.name
            """,
            schema_id=schema_id,
        )
        return [_build_column(record) for record in result]


def column_by_id(column_id: str) -> dict[str, Any] | None:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (d:Database)-[:HAS_SCHEMA]->(s:Schema)-[:HAS_TABLE]->(t:Table)-[:HAS_COLUMN]->(c:Column {id: $id})
            OPTIONAL MATCH (c)-[:HAS_FILL]->(f:Fill)
            WITH d, s, t, c, collect(properties(f)) AS fills
            RETURN c, {id: d.id, name: d.name} AS db, {id: s.id, name: s.name} AS schema,
                   {id: t.id, name: t.name} AS table, fills
            """,
            id=column_id,
        )
        record = result.single()
        if record is None:
            return None
        return _build_column(record)


def _build_column(record) -> dict[str, Any]:
    c = dict(record["c"])
    c["db"] = record["db"]
    c["schema"] = record["schema"]
    c["table"] = record["table"]
    c["tags"] = []
    c["fills"] = record["fills"]
    c["related_terms"] = c.get("related_terms", [])
    c["related_attributes"] = c.get("related_attributes", [])
    return c


# ---------------------------------------------------------------------------
# Fills
# ---------------------------------------------------------------------------

def fill_by_id(fill_id: str) -> dict[str, Any] | None:
    driver = get_driver()
    with driver.session() as session:
        result = session.run(
            """
            MATCH (c:Column)-[:HAS_FILL]->(f:Fill {id: $id})
            RETURN f, {id: c.id, name: c.name} AS column
            """,
            id=fill_id,
        )
        record = result.single()
        if record is None:
            return None
        f = dict(record["f"])
        f["column"] = record["column"]
        return f
