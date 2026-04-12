from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import neo4j_db

router = APIRouter()


def _count_payload(data: object) -> dict:
    if isinstance(data, list):
        return {"data": data, "count": len(data)}
    return {"data": data, "count": 1}


def _parse_schema_or_404(schema_id: str) -> tuple[str, str]:
    parts = neo4j_db.parse_schema_id(schema_id)
    if parts is None:
        raise HTTPException(status_code=404, detail="Schema not found")
    return parts


def _parse_table_or_404(table_id: str) -> tuple[str, str, str]:
    parts = neo4j_db.parse_table_id(table_id)
    if parts is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return parts


def _parse_column_or_404(column_id: str) -> tuple[str, str, str, str]:
    parts = neo4j_db.parse_column_id(column_id)
    if parts is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return parts


@router.get("/dbs")
async def list_databases() -> dict:
    try:
        rows = await run_in_threadpool(neo4j_db.list_databases_as_datasource_payload)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(rows)


@router.get("/dbs/{db_id}/tables")
async def tables_by_database(db_id: str) -> dict:
    try:
        data = await run_in_threadpool(neo4j_db.list_tables_for_database, db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not data:
        raise HTTPException(status_code=404, detail="Database not found")
    return _count_payload(data)


@router.get("/dbs/{db_id}")
async def schemas_by_database(db_id: str) -> dict:
    try:
        data = await run_in_threadpool(neo4j_db.list_schemas_for_database, db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not data:
        raise HTTPException(status_code=404, detail="Database not found")
    return _count_payload(data)


@router.get("/schemas")
async def all_schemas() -> list:
    try:
        return await run_in_threadpool(neo4j_db.list_all_schemas)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@router.get("/schemas/{schema_id}/columns")
async def columns_by_schema(schema_id: str) -> dict:
    db_name, s_name = _parse_schema_or_404(schema_id)
    try:
        data = await run_in_threadpool(neo4j_db.list_columns_for_schema, db_name, s_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(data)


@router.get("/schemas/{schema_id}")
async def tables_by_schema(schema_id: str) -> dict:
    db_name, s_name = _parse_schema_or_404(schema_id)
    try:
        data = await run_in_threadpool(neo4j_db.list_tables_for_schema, db_name, s_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(data)


@router.get("/dbs/{db_id}/columns")
async def columns_by_database(db_id: str) -> dict:
    try:
        data = await run_in_threadpool(neo4j_db.list_columns_for_database, db_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not data:
        raise HTTPException(status_code=404, detail="Database not found")
    return _count_payload(data)


@router.get("/tables/{table_id}")
async def table_by_id(table_id: str) -> dict:
    db_name, s_name, t_name = _parse_table_or_404(table_id)
    try:
        t = await run_in_threadpool(neo4j_db.get_table_by_id, db_name, s_name, t_name)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if t is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return _count_payload(t)


@router.get("/columns/{column_id}")
async def column_by_id(column_id: str) -> dict:
    db_name, s_name, t_name, col_name = _parse_column_or_404(column_id)
    try:
        c = await run_in_threadpool(
            neo4j_db.get_column_by_id, db_name, s_name, t_name, col_name
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if c is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return _count_payload(c)
