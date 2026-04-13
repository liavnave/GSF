"""PostgreSQL connector implementing the NeMo-Retriever SQLDatabase ABC."""

from __future__ import annotations

from typing import Any, Optional

import pandas as pd
import psycopg2
import psycopg2.extras

from nemo_retriever.tabular_data.sql_database import SQLDatabase


class PostgresDatabase(SQLDatabase):
    """Concrete :class:`SQLDatabase` backed by ``psycopg2``.

    Parameters
    ----------
    connection_string:
        A ``libpq``-style connection URI, e.g.
        ``postgresql://user:pass@host:5432/dbname``.
    """

    def __init__(self, connection_string: str) -> None:
        self._connection_string = connection_string
        self._conn: psycopg2.extensions.connection = psycopg2.connect(connection_string)
        self._db_name = self._conn.info.dbname

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    def execute(self, sql: str, parameters: Optional[list] = None) -> pd.DataFrame:
        with self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, parameters)
            if cur.description is None:
                self._conn.commit()
                return pd.DataFrame()
            rows = cur.fetchall()
        return pd.DataFrame(rows)

    # ------------------------------------------------------------------
    # Schema introspection
    # ------------------------------------------------------------------

    def get_tables(self) -> pd.DataFrame:
        sql = """
            SELECT
                current_database() AS database,
                t.table_schema    AS schema,
                t.table_name      AS table_name
            FROM information_schema.tables t
            WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
              AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_schema, t.table_name
        """
        return self.execute(sql)

    def get_columns(self) -> pd.DataFrame:
        sql = """
            SELECT
                current_database()   AS database,
                c.table_schema       AS schema,
                c.table_name         AS table_name,
                c.column_name        AS column_name,
                c.data_type          AS data_type,
                c.is_nullable        AS is_nullable,
                c.ordinal_position   AS ordinal_position
            FROM information_schema.columns c
            WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY c.table_schema, c.table_name, c.ordinal_position
        """
        return self.execute(sql)

    def get_queries(self) -> pd.DataFrame:
        """Return recent queries from ``pg_stat_statements`` if available."""
        try:
            sql = """
                SELECT
                    now()      AS end_time,
                    query      AS query_text
                FROM pg_stat_statements
                ORDER BY total_exec_time DESC
                LIMIT 100
            """
            return self.execute(sql)
        except psycopg2.Error:
            self._conn.rollback()
            return pd.DataFrame(columns=["end_time", "query_text"])

    def get_views(self) -> pd.DataFrame:
        sql = """
            SELECT
                current_database() AS database,
                v.table_schema     AS schema,
                v.table_name       AS table_name,
                v.view_definition  AS view_definition
            FROM information_schema.views v
            WHERE v.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY v.table_schema, v.table_name
        """
        return self.execute(sql)

    def get_pks(self) -> pd.DataFrame:
        sql = """
            SELECT
                current_database()       AS database,
                kcu.table_schema         AS schema,
                kcu.table_name           AS table_name,
                kcu.column_name          AS column_name,
                kcu.ordinal_position     AS ordinal_position
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema    = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY kcu.table_schema, kcu.table_name, kcu.ordinal_position
        """
        return self.execute(sql)

    def get_fks(self) -> pd.DataFrame:
        sql = """
            SELECT
                current_database()       AS database,
                kcu.table_schema         AS schema,
                kcu.table_name           AS table_name,
                kcu.column_name          AS column_name,
                ccu.table_schema         AS referenced_schema,
                ccu.table_name           AS referenced_table,
                ccu.column_name          AS referenced_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema    = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON tc.constraint_name = ccu.constraint_name
             AND tc.table_schema    = ccu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY kcu.table_schema, kcu.table_name, kcu.column_name
        """
        return self.execute(sql)

    # ------------------------------------------------------------------
    # Catalog sync — push introspected metadata into the Neo4j graph
    # ------------------------------------------------------------------

    def sync_to_catalog(self) -> dict[str, Any]:
        """Introspect this Postgres database and upsert into the Neo4j catalog.

        Returns a summary dict with counts of synced schemas, tables, and
        columns.
        """
        from server import neo4j_db

        tables_df = self.get_tables()
        columns_df = self.get_columns()
        pks_df = self.get_pks()

        pk_set: set[tuple[str, str, str, str]] = set()
        if not pks_df.empty:
            for _, pk in pks_df.iterrows():
                pk_set.add(
                    (pk["database"], pk["schema"], pk["table_name"], pk["column_name"])
                )

        driver = neo4j_db.get_driver()
        db_name = self._db_name

        with driver.session(database=neo4j_db.CATALOG_DB) as session:
            session.run(
                "MERGE (db:Database {name: $name})",
                name=db_name,
            )

            schemas_synced: set[str] = set()
            tables_synced = 0
            columns_synced = 0

            for _, tbl in tables_df.iterrows():
                s_name = tbl["schema"]
                t_name = tbl["table_name"]

                if s_name not in schemas_synced:
                    session.run(
                        """
                        MERGE (s:Schema {database_name: $db, name: $schema})
                        WITH s
                        MATCH (db:Database {name: $db})
                        MERGE (db)-[:HAS_SCHEMA]->(s)
                        """,
                        db=db_name,
                        schema=s_name,
                    )
                    schemas_synced.add(s_name)

                session.run(
                    """
                    MERGE (t:Table {database_name: $db, schema_name: $schema,
                                    name: $table})
                    WITH t
                    MATCH (s:Schema {database_name: $db, name: $schema})
                    MERGE (s)-[:HAS_TABLE]->(t)
                    """,
                    db=db_name,
                    schema=s_name,
                    table=t_name,
                )
                tables_synced += 1

            tbl_cols = columns_df.groupby(["schema", "table_name"])
            for (s_name, t_name), group in tbl_cols:
                for _, col in group.iterrows():
                    is_pk = (db_name, s_name, t_name, col["column_name"]) in pk_set
                    session.run(
                        """
                        MERGE (c:Column {database_name: $db, schema_name: $schema,
                                         table_name: $table, name: $col})
                        SET c.data_type        = $dtype,
                            c.is_nullable      = $nullable,
                            c.ordinal_position = $pos,
                            c.is_primary_key   = $is_pk
                        WITH c
                        MATCH (t:Table {database_name: $db, schema_name: $schema,
                                        name: $table})
                        MERGE (t)-[:HAS_COLUMN]->(c)
                        """,
                        db=db_name,
                        schema=s_name,
                        table=t_name,
                        col=col["column_name"],
                        dtype=col["data_type"],
                        nullable=col["is_nullable"],
                        pos=int(col["ordinal_position"]),
                        is_pk=is_pk,
                    )
                    columns_synced += 1

        return {
            "database": db_name,
            "schemas": len(schemas_synced),
            "tables": tables_synced,
            "columns": columns_synced,
        }

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        if self._conn and not self._conn.closed:
            self._conn.close()
