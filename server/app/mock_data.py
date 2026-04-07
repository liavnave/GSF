"""In-memory datasource graph for the API (same shape as client Database / Entity / Table / Column)."""

from __future__ import annotations

import re
from typing import Any

# Mirrors former client mock generators (1 table × 5 columns per schema, three demo DBs).
TABLES_PER_SCHEMA = 1
COLUMNS_PER_TABLE = 5
FILLS_PER_COLUMN = 3

_DATA_MODELS_COLUMN = "column"
_DATA_MODELS_FIELD = "field"
_DATA_MODELS_TABLE = "base table"
_DATA_MODELS_SCHEMA = "schema"
_DATA_MODELS_DB = "db"

_USAGE_HIGH = "high"
_USAGE_MEDIUM = "medium"
_USAGE_LOW = "low"

_COL_TYPES = ("bigint", "varchar", "timestamp", "boolean", "double")


def _nid(i: str, n: str) -> dict[str, str]:
    return {"id": i, "name": n}


def _slug(schema_name: str) -> str:
    return re.sub(r"\s+", "-", schema_name.strip()).lower()


def _make_fill(column_nid: dict[str, str], col_id: str, fill_index: int) -> dict[str, Any]:
    return {
        "id": f"{col_id}-fill-{fill_index}",
        "name": f"field_{fill_index}",
        "description": f"Field {fill_index} under column",
        "type": _DATA_MODELS_FIELD,
        "column": column_nid,
    }


def _make_column(
    db_ref: dict[str, str],
    schema_ref: dict[str, str],
    table_ref: dict[str, str],
    col_index: int,
) -> dict[str, Any]:
    col_id = f"{table_ref['id']}-col-{col_index}"
    col_name = f"col_{col_index}"
    col: dict[str, Any] = {
        "id": col_id,
        "name": col_name,
        "data_type": _COL_TYPES[(col_index - 1) % len(_COL_TYPES)],
        "description": f"Column {col_index}",
        "last_queried": "2024-06-01T12:00:00.000Z",
        "num_of_aliases": 0,
        "num_of_attributes": 0,
        "num_of_const_comparisons": 0,
        "num_of_field_comparisons": 0,
        "num_of_queries": 20 * col_index,
        "num_of_terms": 0,
        "db": db_ref,
        "schema": schema_ref,
        "table": table_ref,
        "label": _DATA_MODELS_COLUMN,
        "tags": [],
        "type": _DATA_MODELS_COLUMN,
        "length": None,
        "scale": None,
        "default_value": None,
        "nullable": col_index > 1,
        "owner_notes": None,
        "syntax_example": None,
        "usage": _USAGE_MEDIUM if col_index % 2 == 0 else _USAGE_LOW,
        "num_of_usage": col_index,
        "related_terms": [],
        "related_attributes": [],
    }
    col_nid = _nid(col_id, col_name)
    col["fills"] = [
        _make_fill(col_nid, col_id, j) for j in range(1, FILLS_PER_COLUMN + 1)
    ]
    return col


def _make_table(
    db_ref: dict[str, str],
    schema_ref: dict[str, str],
    table_index: int,
    num_columns: int,
) -> dict[str, Any]:
    table_id = f"{schema_ref['id']}-tbl-{table_index}"
    table_ref = _nid(table_id, f"table_{table_index}")
    columns = [
        _make_column(db_ref, schema_ref, table_ref, i + 1)
        for i in range(num_columns)
    ]
    return {
        "id": table_id,
        "name": f"table_{table_index}",
        "description": f"Table {table_index} in {schema_ref['name']}",
        "last_queried": "2024-06-01T12:00:00.000Z",
        "num_of_columns": num_columns,
        "num_of_queries": 100 * table_index,
        "num_of_terms": 0,
        "num_of_dup": 0,
        "num_of_filters": 0,
        "num_of_joins": 0,
        "num_of_aggregations": 0,
        "db": db_ref,
        "schema": schema_ref,
        "type": _DATA_MODELS_TABLE,
        "label": _DATA_MODELS_TABLE,
        "tags": [],
        "columns": columns,
        "owner_id": None,
        "owner_notes": None,
        "last_modified": None,
        "created_date": None,
        "retention_time": None,
        "row_count": 10_000 * table_index,
        "size": None,
        "related_terms": [],
        "num_of_usage": 10 * table_index,
        "usage": _USAGE_HIGH,
    }


def _make_schema(
    db_ref: dict[str, str],
    schema_name: str,
    num_tables: int,
    num_columns_per_table: int,
) -> dict[str, Any]:
    schema_id = f"{db_ref['id']}-schema-{_slug(schema_name)}"
    schema_ref = _nid(schema_id, schema_name)
    tables = [
        _make_table(db_ref, schema_ref, ti + 1, num_columns_per_table)
        for ti in range(num_tables)
    ]
    return {
        "id": schema_id,
        "added": "2024-01-10T08:00:00.000Z",
        "description": f"Schema {schema_name}",
        "name": schema_name,
        "tables": tables,
        "num_of_tables": len(tables),
        "type": _DATA_MODELS_SCHEMA,
        "owner_id": None,
        "tags": [],
    }


def _make_database(
    short_index: int,
    name: str,
    connector: str,
    schema_names: list[str],
) -> dict[str, Any]:
    db_id = f"mock-db-{short_index:03d}"
    db_ref = _nid(db_id, name)
    schemas = [
        _make_schema(db_ref, sn, TABLES_PER_SCHEMA, COLUMNS_PER_TABLE)
        for sn in schema_names
    ]
    return {
        "id": db_id,
        "name": name,
        "added": "2024-01-01T00:00:00.000Z",
        "pulled": "2024-06-01T09:00:00.000Z",
        "connector_type": connector,
        "schemas": schemas,
        "type": _DATA_MODELS_DB,
        "owner_id": None,
    }


def _build_indexes(
    databases: list[dict[str, Any]],
) -> tuple[
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
]:
    by_table: dict[str, dict[str, Any]] = {}
    by_column: dict[str, dict[str, Any]] = {}
    by_fill: dict[str, dict[str, Any]] = {}
    for db in databases:
        for sch in db["schemas"]:
            for tbl in sch["tables"]:
                by_table[tbl["id"]] = tbl
                for col in tbl.get("columns") or []:
                    by_column[col["id"]] = col
                    for fill in col.get("fills") or []:
                        by_fill[fill["id"]] = fill
    return by_table, by_column, by_fill


def _build_store() -> tuple[
    list[dict[str, Any]],
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
    dict[str, dict[str, Any]],
]:
    databases = [
        _make_database(1, "Northwind DW", "snowflake", ["raw", "curated", "mart"]),
        _make_database(2, "Sales Lake", "bigquery", ["bronze", "silver"]),
        _make_database(3, "Ops OLTP", "redshift", ["public"]),
    ]
    by_table, by_column, by_fill = _build_indexes(databases)
    return databases, by_table, by_column, by_fill


DATABASES, TABLE_BY_ID, COLUMN_BY_ID, FILL_BY_ID = _build_store()


def db_by_id(db_id: str) -> dict[str, Any] | None:
    for d in DATABASES:
        if d["id"] == db_id:
            return d
    return None


def schema_by_id(schema_id: str) -> tuple[dict[str, Any], dict[str, Any]] | None:
    for d in DATABASES:
        for s in d["schemas"]:
            if s["id"] == schema_id:
                return d, s
    return None


def all_schemas_with_db() -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for d in DATABASES:
        db_nid = _nid(d["id"], d["name"])
        for s in d["schemas"]:
            out.append({**s, "db": db_nid})
    return out


def tables_for_database(db_id: str) -> list[dict[str, Any]]:
    d = db_by_id(db_id)
    if not d:
        return []
    tables: list[dict[str, Any]] = []
    for s in d["schemas"]:
        for t in s["tables"]:
            tables.append({**t, "columns": []})
    return tables


def columns_for_database(db_id: str) -> list[dict[str, Any]]:
    d = db_by_id(db_id)
    if not d:
        return []
    cols: list[dict[str, Any]] = []
    for s in d["schemas"]:
        for t in s["tables"]:
            tid = t["id"]
            full = TABLE_BY_ID.get(tid, t)
            cols.extend(full.get("columns") or [])
    return cols


def columns_for_schema(schema_id: str) -> list[dict[str, Any]]:
    pair = schema_by_id(schema_id)
    if not pair:
        return []
    _, s = pair
    cols: list[dict[str, Any]] = []
    for t in s["tables"]:
        tid = t["id"]
        full = TABLE_BY_ID.get(tid, t)
        cols.extend(full.get("columns") or [])
    return cols


def tables_for_schema(schema_id: str) -> list[dict[str, Any]]:
    pair = schema_by_id(schema_id)
    if not pair:
        return []
    _, s = pair
    return [{**t, "columns": []} for t in s["tables"]]


def entities_for_database(db_id: str) -> list[dict[str, Any]]:
    d = db_by_id(db_id)
    if not d:
        return []
    return list(d["schemas"])
