from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import neo4j_db

router = APIRouter()


def _count_payload(data: object) -> dict:
    if isinstance(data, list):
        return {"data": data, "count": len(data)}
    return {"data": data, "count": 1}


@router.get("/dbs")
async def list_databases() -> dict:
    try:
        rows = await run_in_threadpool(neo4j_db.list_databases)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(rows)


@router.get("/dbs/{db_id}/tables")
async def tables_by_database(db_id: str) -> dict:
    data = await run_in_threadpool(neo4j_db.tables_for_database, db_id)
    if not data and await run_in_threadpool(neo4j_db.db_by_id, db_id) is None:
        raise HTTPException(status_code=404, detail="Database not found")
    return _count_payload(data)


@router.get("/dbs/{db_id}")
async def schemas_by_database(db_id: str) -> dict:
    db = await run_in_threadpool(neo4j_db.db_by_id, db_id)
    if db is None:
        raise HTTPException(status_code=404, detail="Database not found")
    data = await run_in_threadpool(neo4j_db.schemas_for_database, db_id)
    return _count_payload(data)


@router.get("/schemas")
async def all_schemas() -> list:
    return await run_in_threadpool(neo4j_db.all_schemas_with_db)


@router.get("/schemas/{schema_id}")
async def tables_by_schema(schema_id: str) -> dict:
    if not await run_in_threadpool(neo4j_db.schema_exists, schema_id):
        raise HTTPException(status_code=404, detail="Schema not found")
    data = await run_in_threadpool(neo4j_db.tables_for_schema, schema_id)
    return _count_payload(data)


@router.get("/schemas/{schema_id}/columns")
async def columns_by_schema(schema_id: str) -> dict:
    if not await run_in_threadpool(neo4j_db.schema_exists, schema_id):
        raise HTTPException(status_code=404, detail="Schema not found")
    data = await run_in_threadpool(neo4j_db.columns_for_schema, schema_id)
    return _count_payload(data)


@router.get("/dbs/{db_id}/columns")
async def columns_by_database(db_id: str) -> dict:
    if await run_in_threadpool(neo4j_db.db_by_id, db_id) is None:
        raise HTTPException(status_code=404, detail="Database not found")
    data = await run_in_threadpool(neo4j_db.columns_for_database, db_id)
    return _count_payload(data)


@router.get("/tables/{table_id}")
async def table_by_id(table_id: str) -> dict:
    t = await run_in_threadpool(neo4j_db.table_by_id, table_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return _count_payload(t)


@router.get("/columns/{column_id}")
async def column_by_id(column_id: str) -> dict:
    c = await run_in_threadpool(neo4j_db.column_by_id, column_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return _count_payload(c)


@router.get("/fills/{fill_id}")
async def fill_by_id(fill_id: str) -> dict:
    f = await run_in_threadpool(neo4j_db.fill_by_id, fill_id)
    if f is None:
        raise HTTPException(status_code=404, detail="Fill not found")
    return _count_payload(f)
