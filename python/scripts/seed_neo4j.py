"""Seed Neo4j with demo datasource graph (databases, schemas, tables, columns, fills)."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.neo4j_db import close_driver, get_driver

# ---------------------------------------------------------------------------
# Data generation
# ---------------------------------------------------------------------------

TABLES_PER_SCHEMA = 1
COLUMNS_PER_TABLE = 5
FILLS_PER_COLUMN = 3

COL_TYPES = ("bigint", "varchar", "timestamp", "boolean", "double")


def _slug(name: str) -> str:
    return re.sub(r"\s+", "-", name.strip()).lower()


def _nid(i: str, n: str) -> dict[str, str]:
    return {"id": i, "name": n}


def _make_fill(col_nid: dict[str, str], col_id: str, fill_index: int) -> dict[str, Any]:
    return {
        "id": f"{col_id}.field_{fill_index}",
        "name": f"field_{fill_index}",
        "description": f"Field {fill_index} under column",
        "type": "field",
        "column": col_nid,
    }


def _make_column(
    db_ref: dict[str, str],
    schema_ref: dict[str, str],
    table_ref: dict[str, str],
    col_index: int,
) -> dict[str, Any]:
    col_id = f"{table_ref['id']}.col_{col_index}"
    col_name = f"col_{col_index}"
    col: dict[str, Any] = {
        "id": col_id,
        "name": col_name,
        "data_type": COL_TYPES[(col_index - 1) % len(COL_TYPES)],
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
        "label": "column",
        "type": "column",
        "nullable": col_index > 1,
        "usage": "medium" if col_index % 2 == 0 else "low",
        "num_of_usage": col_index,
    }
    col_nid = _nid(col_id, col_name)
    col["fills"] = [_make_fill(col_nid, col_id, j) for j in range(1, FILLS_PER_COLUMN + 1)]
    return col


def _make_table(
    db_ref: dict[str, str],
    schema_ref: dict[str, str],
    table_index: int,
    num_columns: int,
) -> dict[str, Any]:
    table_id = f"{schema_ref['id']}.table_{table_index}"
    table_ref = _nid(table_id, f"table_{table_index}")
    columns = [_make_column(db_ref, schema_ref, table_ref, i + 1) for i in range(num_columns)]
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
        "type": "base table",
        "label": "base table",
        "columns": columns,
        "owner_id": None,
        "row_count": 10_000 * table_index,
        "num_of_usage": 10 * table_index,
        "usage": "high",
    }


def _make_schema(
    db_ref: dict[str, str],
    schema_name: str,
    num_tables: int,
    num_columns_per_table: int,
) -> dict[str, Any]:
    schema_id = f"{db_ref['id']}.{_slug(schema_name)}"
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
        "type": "schema",
        "owner_id": None,
    }


def _make_database(name: str, connector: str, schema_names: list[str]) -> dict[str, Any]:
    db_id = _slug(name)
    db_ref = _nid(db_id, name)
    schemas = [
        _make_schema(db_ref, sn, TABLES_PER_SCHEMA, COLUMNS_PER_TABLE) for sn in schema_names
    ]
    return {
        "id": db_id,
        "name": name,
        "added": "2024-01-01T00:00:00.000Z",
        "pulled": "2024-06-01T09:00:00.000Z",
        "connector_type": connector,
        "schemas": schemas,
        "type": "db",
        "owner_id": None,
    }


DATABASES = [
    _make_database("Northwind DW", "snowflake", ["raw", "curated", "mart"]),
    _make_database("Sales Lake", "bigquery", ["bronze", "silver"]),
    _make_database("Ops OLTP", "redshift", ["public"]),
]

# ---------------------------------------------------------------------------
# Neo4j write helpers
# ---------------------------------------------------------------------------


def _clear(tx):
    tx.run("MATCH (n) DETACH DELETE n")


def _create_database(tx, db: dict):
    tx.run(
        """
        CREATE (d:Database {
            id: $id, name: $name, added: $added, pulled: $pulled,
            connector_type: $connector_type, type: $type, owner_id: $owner_id
        })
        """,
        id=db["id"],
        name=db["name"],
        added=db["added"],
        pulled=db["pulled"],
        connector_type=db["connector_type"],
        type=db["type"],
        owner_id=db.get("owner_id"),
    )


def _create_schema(tx, schema: dict, db_id: str):
    tx.run(
        """
        MATCH (d:Database {id: $db_id})
        CREATE (s:Schema {
            id: $id, name: $name, added: $added, description: $description,
            num_of_tables: $num_of_tables, type: $type, owner_id: $owner_id
        })
        CREATE (d)-[:HAS_SCHEMA]->(s)
        """,
        db_id=db_id,
        id=schema["id"],
        name=schema["name"],
        added=schema["added"],
        description=schema["description"],
        num_of_tables=schema["num_of_tables"],
        type=schema["type"],
        owner_id=schema.get("owner_id"),
    )


def _create_table(tx, table: dict, schema_id: str):
    tx.run(
        """
        MATCH (s:Schema {id: $schema_id})
        CREATE (t:Table {
            id: $id, name: $name, description: $description,
            last_queried: $last_queried, num_of_columns: $num_of_columns,
            num_of_queries: $num_of_queries, num_of_terms: $num_of_terms,
            num_of_dup: $num_of_dup, num_of_filters: $num_of_filters,
            num_of_joins: $num_of_joins, num_of_aggregations: $num_of_aggregations,
            type: $type, label: $label, owner_id: $owner_id,
            row_count: $row_count, num_of_usage: $num_of_usage, usage: $usage,
            db_id: $db_id, schema_id: $schema_id2
        })
        CREATE (s)-[:HAS_TABLE]->(t)
        """,
        schema_id=schema_id,
        id=table["id"],
        name=table["name"],
        description=table["description"],
        last_queried=table["last_queried"],
        num_of_columns=table["num_of_columns"],
        num_of_queries=table["num_of_queries"],
        num_of_terms=table["num_of_terms"],
        num_of_dup=table["num_of_dup"],
        num_of_filters=table["num_of_filters"],
        num_of_joins=table["num_of_joins"],
        num_of_aggregations=table["num_of_aggregations"],
        type=table["type"],
        label=table["label"],
        owner_id=table.get("owner_id"),
        row_count=table["row_count"],
        num_of_usage=table["num_of_usage"],
        usage=table["usage"],
        db_id=table["db"]["id"],
        schema_id2=schema_id,
    )


def _create_column(tx, col: dict, table_id: str):
    tx.run(
        """
        MATCH (t:Table {id: $table_id})
        CREATE (c:Column {
            id: $id, name: $name, data_type: $data_type, description: $description,
            last_queried: $last_queried, num_of_aliases: $num_of_aliases,
            num_of_attributes: $num_of_attributes,
            num_of_const_comparisons: $num_of_const_comparisons,
            num_of_field_comparisons: $num_of_field_comparisons,
            num_of_queries: $num_of_queries, num_of_terms: $num_of_terms,
            label: $label, type: $type, nullable: $nullable,
            usage: $usage, num_of_usage: $num_of_usage,
            db_id: $db_id, schema_id: $schema_id, table_id: $table_id2
        })
        CREATE (t)-[:HAS_COLUMN]->(c)
        """,
        table_id=table_id,
        id=col["id"],
        name=col["name"],
        data_type=col["data_type"],
        description=col["description"],
        last_queried=col["last_queried"],
        num_of_aliases=col["num_of_aliases"],
        num_of_attributes=col["num_of_attributes"],
        num_of_const_comparisons=col["num_of_const_comparisons"],
        num_of_field_comparisons=col["num_of_field_comparisons"],
        num_of_queries=col["num_of_queries"],
        num_of_terms=col["num_of_terms"],
        label=col["label"],
        type=col["type"],
        nullable=col["nullable"],
        usage=col["usage"],
        num_of_usage=col["num_of_usage"],
        db_id=col["db"]["id"],
        schema_id=col["schema"]["id"],
        table_id2=table_id,
    )


def _create_fill(tx, fill: dict, col_id: str):
    tx.run(
        """
        MATCH (c:Column {id: $col_id})
        CREATE (f:Fill {
            id: $id, name: $name, description: $description, type: $type,
            column_id: $column_id
        })
        CREATE (c)-[:HAS_FILL]->(f)
        """,
        col_id=col_id,
        id=fill["id"],
        name=fill["name"],
        description=fill["description"],
        type=fill["type"],
        column_id=fill["column"]["id"],
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def seed():
    driver = get_driver()

    with driver.session() as session:
        print("Clearing existing data...")
        session.execute_write(_clear)

        for db in DATABASES:
            print(f"  Creating database: {db['name']}")
            session.execute_write(_create_database, db)

            for schema in db["schemas"]:
                print(f"    Creating schema: {schema['name']}")
                session.execute_write(_create_schema, schema, db["id"])

                for table in schema["tables"]:
                    print(f"      Creating table: {table['name']}")
                    session.execute_write(_create_table, table, schema["id"])

                    for col in table["columns"]:
                        session.execute_write(_create_column, col, table["id"])

                        for fill in col.get("fills", []):
                            session.execute_write(_create_fill, fill, col["id"])

    close_driver()
    print("Done! Neo4j seeded with demo data.")


if __name__ == "__main__":
    seed()
