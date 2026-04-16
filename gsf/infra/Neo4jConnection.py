"""Neo4j access — class layout similar to illumex ``Neo4jConnection`` / manager.

Env files (later overrides earlier): ``<repo>/.env``, then ``<repo>/gsf/.env``.
Paths follow this file: ``gsf/infra/Neo4jConnection.py``.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Final

from dotenv import load_dotenv
from neo4j import Driver, GraphDatabase, NotificationMinimumSeverity

_infra_dir: Final = Path(__file__).resolve().parent
_gsf_dir: Final = _infra_dir.parent
_repo_root: Final = _gsf_dir.parent

_ENV_REPO: Final[Path] = _repo_root / ".env"
_ENV_GSF: Final[Path] = _gsf_dir / ".env"


def _refresh_env_from_files() -> None:
    """Reload ``.env`` on each connect attempt (not frozen after a bad first import)."""
    load_dotenv(_ENV_REPO, override=True)
    load_dotenv(_ENV_GSF, override=True)


def load_repository_env() -> None:
    """Load repo root ``.env`` then ``gsf/.env`` (later overrides). Safe to call repeatedly."""
    _refresh_env_from_files()


def neo4j_settings() -> tuple[str, str, str]:
    """Return ``(uri, user, password)`` from the environment after loading ``.env`` files."""
    _refresh_env_from_files()
    uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687").strip()
    user = os.environ.get("NEO4J_USERNAME", "neo4j").strip()
    password = os.environ.get("NEO4J_PASSWORD", "").strip()
    return uri, user, password


class Neo4jConnection:
    """Holds one lazy :class:`~neo4j.Driver` built from explicit credentials."""

    def __init__(self, uri: str, username: str, password: str) -> None:
        self._uri = uri
        self._username = username
        self._password = password
        self._driver: Driver | None = None

    @property
    def driver(self) -> Driver:
        if self._driver is None:
            self._driver = GraphDatabase.driver(
                self._uri,
                auth=(self._username, self._password),
                max_connection_lifetime=290,
                liveness_check_timeout=4,
                notifications_min_severity=NotificationMinimumSeverity.OFF,
            )
        return self._driver

    def verify_connectivity(self) -> None:
        self.driver.verify_connectivity()

    def close(self) -> None:
        if self._driver is not None:
            self._driver.close()
            self._driver = None


class Neo4jConnectionManager:
    """Process-wide singleton: :class:`Neo4jConnection` from repo ``.env`` files."""

    def __init__(self) -> None:
        self._conn: Neo4jConnection | None = None

    def connection(self) -> Neo4jConnection:
        if self._conn is None:
            uri, user, password = neo4j_settings()
            if not password:
                msg = (
                    "NEO4J_PASSWORD is not set after loading .env. "
                    f"Looked for {_ENV_REPO} (exists={_ENV_REPO.is_file()}), "
                    f"{_ENV_GSF} (exists={_ENV_GSF.is_file()}). "
                    "Add NEO4J_PASSWORD there or export it before starting uvicorn."
                )
                raise RuntimeError(msg)
            self._conn = Neo4jConnection(uri, user, password)
        return self._conn

    @property
    def driver(self) -> Driver:
        return self.connection().driver

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
            self._conn = None

    def verify_connectivity(self) -> None:
        self.connection().verify_connectivity()


_manager = Neo4jConnectionManager()


def get_driver() -> Driver:
    """Return the shared driver (lazy; first call loads ``.env`` and may open the pool)."""
    return _manager.driver


def close_driver() -> None:
    """Close the shared driver (e.g. FastAPI shutdown)."""
    _manager.close()


def get_neo4j_manager() -> Neo4jConnectionManager:
    """Access the process singleton (e.g. ``.connection()`` or ``.verify_connectivity()``)."""
    return _manager
