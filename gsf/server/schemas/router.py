"""API route handlers for datasources and connectors."""

from __future__ import annotations

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


def _parse_schema_or_404(schema_id: str) -> tuple[str, str]:
    parts = dal.parse_schema_id(schema_id)
    if parts is None:
        raise HTTPException(status_code=404, detail="Schema not found")
    return parts


def _parse_table_or_404(table_id: str) -> tuple[str, str, str]:
    parts = dal.parse_table_id(table_id)
    if parts is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return parts


def _parse_column_or_404(column_id: str) -> tuple[str, str, str, str]:
    parts = dal.parse_column_id(column_id)
    if parts is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return parts


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


@router.get("/datasources/dbs/{db_id}/tables")
def tables_by_database(db_id: str) -> dict:
    try:
        data = dal.list_tables_for_database(db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not data:
        raise HTTPException(status_code=404, detail="Database not found")
    return _count_payload(data)


@router.get("/datasources/dbs/{db_id}")
def schemas_by_database(db_id: str) -> dict:
    try:
        data = dal.list_schemas_for_database(db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not data:
        raise HTTPException(status_code=404, detail="Database not found")
    return _count_payload(data)


@router.get("/datasources/schemas")
def all_schemas() -> list:
    try:
        return dal.list_all_schemas()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/datasources/schemas/{schema_id}/columns")
def columns_by_schema(schema_id: str) -> dict:
    db_name, s_name = _parse_schema_or_404(schema_id)
    try:
        data = dal.list_columns_for_schema(db_name, s_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(data)


@router.get("/datasources/schemas/{schema_id}")
def tables_by_schema(schema_id: str) -> dict:
    db_name, s_name = _parse_schema_or_404(schema_id)
    try:
        data = dal.list_tables_for_schema(db_name, s_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(data)


@router.get("/datasources/dbs/{db_id}/columns")
def columns_by_database(db_id: str) -> dict:
    try:
        data = dal.list_columns_for_database(db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not data:
        raise HTTPException(status_code=404, detail="Database not found")
    return _count_payload(data)


@router.get("/datasources/tables/{table_id}")
def table_by_id(table_id: str) -> dict:
    db_name, s_name, t_name = _parse_table_or_404(table_id)
    try:
        t = dal.get_table(db_name, s_name, t_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if t is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return _count_payload(t)


@router.get("/datasources/columns/{column_id}")
def column_by_id(column_id: str) -> dict:
    db_name, s_name, t_name, col_name = _parse_column_or_404(column_id)
    try:
        c = dal.get_column(db_name, s_name, t_name, col_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if c is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return _count_payload(c)


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
