"""API route handlers for datasources and connectors."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.connectors.postgres import PostgresDatabase
from server.schemas import dal

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _count_payload(data: object) -> dict:
    if isinstance(data, list):
        return {"data": data, "count": len(data)}
    return {"data": data, "count": 1}


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


@router.get("/datasources/dbs/catalog-branch")
def catalog_branch(
    db_id: str,
    schema_name: str | None = None,
    table_name: str | None = None,
) -> dict[str, Any]:
    """Catalog subtree: always schemas for db; optional tables + columns for one path.

    Replaces separate /schemas, /tables, and /columns routes — one contract for the UI.
    """
    if table_name is not None and schema_name is None:
        raise HTTPException(
            status_code=400,
            detail="schema_name is required when table_name is set",
        )
    try:
        dbs = dal.list_databases()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    try:
        schemas = dal.list_schemas_for_database(db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not schemas:
        raise HTTPException(status_code=404, detail="Database not found")
    payload: dict[str, Any] = {"dbs": dbs, "schemas": schemas}
    if schema_name is not None:
        try:
            payload["tables"] = dal.list_tables_for_schema(db_id, schema_name)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e)) from e
    if schema_name is not None and table_name is not None:
        cols = dal.list_columns_for_table(db_id, schema_name, table_name)
        if cols is None:
            raise HTTPException(status_code=404, detail="Table not found")
        payload["columns"] = cols
    return {"data": payload, "count": len(payload["dbs"])}