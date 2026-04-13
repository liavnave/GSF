"""API routes for database connectors."""

from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from app.connectors.postgres import PostgresDatabase

router = APIRouter()


class PostgresConnectRequest(BaseModel):
    connection_string: str


class PostgresQueryRequest(BaseModel):
    connection_string: str
    sql: str


@router.post("/postgres/test")
def test_postgres_connection(body: PostgresConnectRequest) -> dict:
    """Verify that the given Postgres connection string is reachable."""
    try:
        with PostgresDatabase(body.connection_string) as db:
            result = db.execute("SELECT 1 AS ok")
            return {"status": "ok", "result": result.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.post("/postgres/introspect")
def introspect_postgres(body: PostgresConnectRequest) -> dict:
    """Return the full schema metadata (tables, columns, PKs, FKs, views)."""
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


@router.post("/postgres/sync")
def sync_postgres_to_catalog(body: PostgresConnectRequest) -> dict:
    """Introspect a Postgres database and sync its metadata into the Neo4j catalog."""
    try:
        with PostgresDatabase(body.connection_string) as db:
            summary = db.sync_to_catalog()
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return {"status": "synced", **summary}


@router.post("/postgres/query")
def run_postgres_query(body: PostgresQueryRequest) -> dict:
    """Execute an arbitrary SQL query against a Postgres database."""
    try:
        with PostgresDatabase(body.connection_string) as db:
            result = db.execute(body.sql)
            rows = result.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    return {"data": rows, "count": len(rows)}
