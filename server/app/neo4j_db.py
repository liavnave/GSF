from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError

_app_dir = Path(__file__).resolve().parent
_server_dir = _app_dir.parent
_repo_root = _server_dir.parent

_driver = None


def _load_env() -> None:
    # Call on each connect attempt so values are not frozen from a failed first import.
    load_dotenv(_repo_root / ".env", override=True)
    load_dotenv(_server_dir / ".env", override=True)


def _neo4j_config() -> tuple[str, str, str]:
    _load_env()
    uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687").strip()
    user = os.environ.get("NEO4J_USERNAME", "neo4j").strip()
    password = os.environ.get("NEO4J_PASSWORD", "").strip()
    return uri, user, password


def get_driver():
    global _driver
    uri, user, password = _neo4j_config()
    if not password:
        root_env = _repo_root / ".env"
        server_env = _server_dir / ".env"
        msg = (
            "NEO4J_PASSWORD is not set after loading .env. "
            f"Looked for {root_env} (exists={root_env.is_file()}), "
            f"{server_env} (exists={server_env.is_file()}). "
            "Add NEO4J_PASSWORD there or export it before starting uvicorn."
        )
        raise RuntimeError(msg)
    if _driver is None:
        _driver = GraphDatabase.driver(uri, auth=(user, password))
    return _driver


def close_driver() -> None:
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def list_database_names() -> list[str]:
    driver = get_driver()
    try:
        with driver.session(database="system") as session:
            result = session.run(
                "SHOW DATABASES YIELD name RETURN name ORDER BY name",
            )
            return [record["name"] for record in result]
    except Neo4jError as e:
        raise RuntimeError(str(e)) from e


def _iso_utc_z() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def list_databases_as_datasource_payload() -> list[dict[str, Any]]:
    """Shape matches client `Database` (schemas empty until graph metadata is wired)."""
    names = list_database_names()
    stamp = _iso_utc_z()
    return [
        {
            "id": name,
            "name": name,
            "added": stamp,
            "pulled": stamp,
            "connector_type": "neo4j",
            "schemas": [],
            "type": "db",
            "owner_id": None,
        }
        for name in names
    ]
