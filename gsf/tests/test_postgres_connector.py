"""Tests for the PostgresDatabase connector.

These tests mock psycopg2 so no real Postgres instance is needed.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.connectors.postgres import PostgresDatabase


@pytest.fixture()
def mock_conn():
    """Return a mocked psycopg2 connection and a factory to set cursor results."""
    conn = MagicMock()
    conn.closed = False
    conn.info.dbname = "test_db"

    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = cursor

    return conn, cursor


@pytest.fixture()
def pg(mock_conn):
    """Return a PostgresDatabase with a mocked connection."""
    conn, _ = mock_conn
    with patch("app.connectors.postgres.psycopg2.connect", return_value=conn):
        db = PostgresDatabase("postgresql://user:pass@localhost:5432/test_db")
    return db


class TestPostgresDatabaseInit:
    def test_stores_db_name(self, pg):
        assert pg._db_name == "test_db"

    def test_implements_sql_database(self, pg):
        from app.connectors._nemo_import import get_sql_database_class

        assert isinstance(pg, get_sql_database_class())


class TestExecute:
    def test_returns_dataframe(self, pg, mock_conn):
        _, cursor = mock_conn
        cursor.description = [("id",), ("name",)]
        cursor.fetchall.return_value = [{"id": 1, "name": "alice"}]

        result = pg.execute("SELECT * FROM users")

        assert isinstance(result, pd.DataFrame)
        assert list(result.columns) == ["id", "name"]
        assert len(result) == 1

    def test_no_result_set_returns_empty(self, pg, mock_conn):
        _, cursor = mock_conn
        cursor.description = None

        result = pg.execute("CREATE TABLE foo (id int)")

        assert isinstance(result, pd.DataFrame)
        assert result.empty


class TestIntrospection:
    def test_get_tables_executes_query(self, pg, mock_conn):
        _, cursor = mock_conn
        cursor.description = [("database",), ("schema",), ("table_name",)]
        cursor.fetchall.return_value = [
            {"database": "test_db", "schema": "public", "table_name": "users"},
        ]

        tables = pg.get_tables()

        assert isinstance(tables, pd.DataFrame)
        assert "table_name" in tables.columns
        cursor.execute.assert_called_once()
        sql_arg = cursor.execute.call_args[0][0]
        assert "information_schema.tables" in sql_arg

    def test_get_columns_executes_query(self, pg, mock_conn):
        _, cursor = mock_conn
        cursor.description = [
            ("database",),
            ("schema",),
            ("table_name",),
            ("column_name",),
            ("data_type",),
            ("is_nullable",),
            ("ordinal_position",),
        ]
        cursor.fetchall.return_value = [
            {
                "database": "test_db",
                "schema": "public",
                "table_name": "users",
                "column_name": "id",
                "data_type": "integer",
                "is_nullable": "NO",
                "ordinal_position": 1,
            },
        ]

        cols = pg.get_columns()

        assert isinstance(cols, pd.DataFrame)
        assert "column_name" in cols.columns

    def test_get_pks_executes_query(self, pg, mock_conn):
        _, cursor = mock_conn
        cursor.description = [
            ("database",),
            ("schema",),
            ("table_name",),
            ("column_name",),
            ("ordinal_position",),
        ]
        cursor.fetchall.return_value = []

        pks = pg.get_pks()

        assert isinstance(pks, pd.DataFrame)

    def test_get_fks_executes_query(self, pg, mock_conn):
        _, cursor = mock_conn
        cursor.description = [
            ("database",),
            ("schema",),
            ("table_name",),
            ("column_name",),
            ("referenced_schema",),
            ("referenced_table",),
            ("referenced_column",),
        ]
        cursor.fetchall.return_value = []

        fks = pg.get_fks()

        assert isinstance(fks, pd.DataFrame)

    def test_get_views_executes_query(self, pg, mock_conn):
        _, cursor = mock_conn
        cursor.description = [
            ("database",),
            ("schema",),
            ("table_name",),
            ("view_definition",),
        ]
        cursor.fetchall.return_value = []

        views = pg.get_views()

        assert isinstance(views, pd.DataFrame)

    def test_get_queries_returns_empty_on_error(self, pg, mock_conn):
        import psycopg2

        _, cursor = mock_conn
        cursor.execute.side_effect = psycopg2.Error("extension not available")

        queries = pg.get_queries()

        assert isinstance(queries, pd.DataFrame)
        assert list(queries.columns) == ["end_time", "query_text"]
        assert queries.empty


class TestContextManager:
    def test_closes_on_exit(self, mock_conn):
        conn, _ = mock_conn
        with patch("app.connectors.postgres.psycopg2.connect", return_value=conn):
            with PostgresDatabase("postgresql://u:p@h/db"):
                pass
        conn.close.assert_called_once()


class TestSyncToCatalog:
    def test_sync_returns_summary(self, pg, mock_conn):
        _, cursor = mock_conn

        call_count = 0

        def _side_effect(sql, params=None):
            nonlocal call_count
            call_count += 1

        cursor.execute.side_effect = _side_effect

        tables_df = pd.DataFrame(
            [{"database": "test_db", "schema": "public", "table_name": "users"}]
        )
        columns_df = pd.DataFrame(
            [
                {
                    "database": "test_db",
                    "schema": "public",
                    "table_name": "users",
                    "column_name": "id",
                    "data_type": "integer",
                    "is_nullable": "NO",
                    "ordinal_position": 1,
                }
            ]
        )
        pks_df = pd.DataFrame(
            [
                {
                    "database": "test_db",
                    "schema": "public",
                    "table_name": "users",
                    "column_name": "id",
                    "ordinal_position": 1,
                }
            ]
        )

        mock_driver = MagicMock()
        mock_session = MagicMock()
        mock_driver.session.return_value.__enter__ = MagicMock(
            return_value=mock_session
        )
        mock_driver.session.return_value.__exit__ = MagicMock(return_value=False)

        with (
            patch.object(pg, "get_tables", return_value=tables_df),
            patch.object(pg, "get_columns", return_value=columns_df),
            patch.object(pg, "get_pks", return_value=pks_df),
            patch("app.neo4j_db.get_driver", return_value=mock_driver),
        ):
            summary = pg.sync_to_catalog()

        assert summary["database"] == "test_db"
        assert summary["schemas"] == 1
        assert summary["tables"] == 1
        assert summary["columns"] == 1
