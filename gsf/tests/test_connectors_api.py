"""Tests for the /api/connectors router endpoints."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pandas as pd


class TestPostgresTestEndpoint:
    def test_success(self, client):
        mock_db = MagicMock()
        mock_db.__enter__ = MagicMock(return_value=mock_db)
        mock_db.__exit__ = MagicMock(return_value=False)
        mock_db.execute.return_value = pd.DataFrame([{"ok": 1}])

        with patch("server.schemas.router.PostgresDatabase", return_value=mock_db):
            resp = client.post(
                "/api/connectors/postgres/test",
                json={"connection_string": "postgresql://u:p@h/db"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["result"] == [{"ok": 1}]

    def test_connection_failure(self, client):
        with patch(
            "server.schemas.router.PostgresDatabase",
            side_effect=Exception("connection refused"),
        ):
            resp = client.post(
                "/api/connectors/postgres/test",
                json={"connection_string": "postgresql://u:p@h/db"},
            )

        assert resp.status_code == 503


class TestPostgresIntrospectEndpoint:
    def test_returns_schema_metadata(self, client):
        mock_db = MagicMock()
        mock_db.__enter__ = MagicMock(return_value=mock_db)
        mock_db.__exit__ = MagicMock(return_value=False)
        mock_db.get_tables.return_value = pd.DataFrame(
            [{"database": "db", "schema": "public", "table_name": "t1"}]
        )
        mock_db.get_columns.return_value = pd.DataFrame(
            columns=[
                "database",
                "schema",
                "table_name",
                "column_name",
                "data_type",
                "is_nullable",
            ]
        )
        mock_db.get_pks.return_value = pd.DataFrame(
            columns=[
                "database",
                "schema",
                "table_name",
                "column_name",
                "ordinal_position",
            ]
        )
        mock_db.get_fks.return_value = pd.DataFrame(
            columns=[
                "database",
                "schema",
                "table_name",
                "column_name",
                "referenced_schema",
                "referenced_table",
                "referenced_column",
            ]
        )
        mock_db.get_views.return_value = pd.DataFrame(
            columns=["database", "schema", "table_name", "view_definition"]
        )

        with patch("server.schemas.router.PostgresDatabase", return_value=mock_db):
            resp = client.post(
                "/api/connectors/postgres/introspect",
                json={"connection_string": "postgresql://u:p@h/db"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["tables"]) == 1
        assert body["tables"][0]["table_name"] == "t1"


class TestPostgresSyncEndpoint:
    def test_returns_summary(self, client):
        mock_db = MagicMock()
        mock_db.__enter__ = MagicMock(return_value=mock_db)
        mock_db.__exit__ = MagicMock(return_value=False)
        mock_db.sync_to_catalog.return_value = {
            "database": "mydb",
            "schemas": 2,
            "tables": 5,
            "columns": 20,
        }

        with patch("server.schemas.router.PostgresDatabase", return_value=mock_db):
            resp = client.post(
                "/api/connectors/postgres/sync",
                json={"connection_string": "postgresql://u:p@h/db"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "synced"
        assert body["tables"] == 5


class TestPostgresQueryEndpoint:
    def test_returns_rows(self, client):
        mock_db = MagicMock()
        mock_db.__enter__ = MagicMock(return_value=mock_db)
        mock_db.__exit__ = MagicMock(return_value=False)
        mock_db.execute.return_value = pd.DataFrame(
            [{"id": 1, "name": "alice"}, {"id": 2, "name": "bob"}]
        )

        with patch("server.schemas.router.PostgresDatabase", return_value=mock_db):
            resp = client.post(
                "/api/connectors/postgres/query",
                json={
                    "connection_string": "postgresql://u:p@h/db",
                    "sql": "SELECT * FROM users",
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 2
        assert body["data"][0]["name"] == "alice"
