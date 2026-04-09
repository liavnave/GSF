from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import mock_data, neo4j_db

router = APIRouter()


def _count_payload(data: object) -> dict:
    if isinstance(data, list):
        return {"data": data, "count": len(data)}
    return {"data": data, "count": 1}


@router.get("/dbs")
async def list_databases() -> dict:
    try:
        rows = await run_in_threadpool(neo4j_db.list_databases_as_datasource_payload)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return _count_payload(rows)


@router.get("/dbs/{db_id}/tables")
async def tables_by_database(db_id: str) -> dict:
    if mock_data.db_by_id(db_id) is None:
        raise HTTPException(status_code=404, detail="Database not found")
    data = mock_data.tables_for_database(db_id)
    return _count_payload(data)


@router.get("/dbs/{db_id}")
async def schemas_by_database(db_id: str) -> dict:
    if mock_data.db_by_id(db_id) is None:
        raise HTTPException(status_code=404, detail="Database not found")
    data = mock_data.entities_for_database(db_id)
    return _count_payload(data)


@router.get("/schemas")
async def all_schemas() -> list:
    return mock_data.all_schemas_with_db()


@router.get("/schemas/{schema_id}")
async def tables_by_schema(schema_id: str) -> dict:
    if mock_data.schema_by_id(schema_id) is None:
        raise HTTPException(status_code=404, detail="Schema not found")
    data = mock_data.tables_for_schema(schema_id)
    return _count_payload(data)


@router.get("/schemas/{schema_id}/columns")
async def columns_by_schema(schema_id: str) -> dict:
    if mock_data.schema_by_id(schema_id) is None:
        raise HTTPException(status_code=404, detail="Schema not found")
    data = mock_data.columns_for_schema(schema_id)
    return _count_payload(data)


@router.get("/dbs/{db_id}/columns")
async def columns_by_database(db_id: str) -> dict:
    if mock_data.db_by_id(db_id) is None:
        raise HTTPException(status_code=404, detail="Database not found")
    data = mock_data.columns_for_database(db_id)
    return _count_payload(data)


@router.get("/tables/{table_id}")
async def table_by_id(table_id: str) -> dict:
    t = mock_data.TABLE_BY_ID.get(table_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Table not found")
    return _count_payload(t)


@router.get("/columns/{column_id}")
async def column_by_id(column_id: str) -> dict:
    c = mock_data.COLUMN_BY_ID.get(column_id)
    if c is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return _count_payload(c)


@router.get("/fills/{fill_id}")
async def fill_by_id(fill_id: str) -> dict:
    f = mock_data.FILL_BY_ID.get(fill_id)
    if f is None:
        raise HTTPException(status_code=404, detail="Fill not found")
    return _count_payload(f)
