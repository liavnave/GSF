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


@router.get("/datasources/dbs/{db_id}/catalog-branch")
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


# ---------------------------------------------------------------------------
# Connector routes (/api/connectors)
# ---------------------------------------------------------------------------


class PostgresConnectRequest(BaseModel):
    connection_string: str


class PostgresQueryRequest(BaseModel):
    connection_string: str
    sql: str


@router.post("/connectors/postgres/test")
def test_postgres_connection(body: PostgresConnectRequest) -> dict:
    try:
        with PostgresDatabase(body.connection_string) as db:
            result = db.execute("SELECT 1 AS ok")
            return {"status": "ok", "result": result.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/connectors/postgres/introspect")
def introspect_postgres(body: PostgresConnectRequest) -> dict:
    try:
        with PostgresDatabase(body.connection_string) as db:
            tables = db.get_tables().to_dict(orient="records")
            columns = db.get_columns().to_dict(orient="records")
            pks = db.get_pks().to_dict(orient="records")
            fks = db.get_fks().to_dict(orient="records")
            views = db.get_views().to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return {
        "tables": tables,
        "columns": columns,
        "primary_keys": pks,
        "foreign_keys": fks,
        "views": views,
    }


@router.post("/connectors/postgres/sync")
def sync_postgres_to_catalog(body: PostgresConnectRequest) -> dict:
    try:
        with PostgresDatabase(body.connection_string) as db:
            summary = db.sync_to_catalog()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return {"status": "synced", **summary}


@router.post("/connectors/postgres/query")
def run_postgres_query(body: PostgresQueryRequest) -> dict:
    try:
        with PostgresDatabase(body.connection_string) as db:
            result = db.execute(body.sql)
            rows = result.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return {"data": rows, "count": len(rows)}
