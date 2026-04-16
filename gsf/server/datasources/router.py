"""API route handlers for datasources and connectors."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from server.datasources import dal

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _count_payload(data: object) -> dict:
    if isinstance(data, list):
        return {"data": data, "count": len(data)}
    return {"data": data, "count": 1}


# ---------------------------------------------------------------------------
# Catalog lazy tree (/api/schemas, /api/tables, /api/columns)
# ---------------------------------------------------------------------------


@router.get("/schemas/{db_id}")
def list_schemas_by_database(db_id: str) -> dict:
    """Schemas for a database. ``db_id`` is element id, property ``id``, or ``Database.name``."""
    try:
        result = dal.list_schemas_for_database(db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if result is None:
        raise HTTPException(status_code=404, detail="Database not found")
    return result


@router.get("/tables/{schema_id}")
def list_tables_by_schema(
    schema_id: str,
    database_name: str | None = None,
) -> dict:
    """Tables under a schema (lazy tree). ``schema_id`` is element id, property ``id``, or name with ``database_name``."""
    try:
        rows = dal.list_tables_for_schema(schema_id, database_name=database_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(rows)


@router.get("/columns/{table_id}")
def list_columns_by_table(table_id: str) -> dict:
    """Columns for a table. ``table_id`` is the Table node's ``id`` property."""
    try:
        result = dal.list_columns_for_table(table_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if result is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return _count_payload(result)


# ---------------------------------------------------------------------------
# Datasource routes (/api/datasources)
# ---------------------------------------------------------------------------


@router.get("/datasources/dbs")
def list_databases() -> dict:
    try:
        rows = dal.list_databases()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(rows)
