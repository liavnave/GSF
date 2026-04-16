"""Neo4j connection helpers adapted from NeMo-Retriever."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Final

from dotenv import load_dotenv
from neo4j import (
    Driver,
    GraphDatabase,
    NotificationMinimumSeverity,
    Result,
    RoutingControl,
)

logger = logging.getLogger(__name__)

_infra_dir: Final = Path(__file__).resolve().parent
_gsf_dir: Final = _infra_dir.parent
_repo_root: Final = _gsf_dir.parent

_ENV_REPO: Final[Path] = _repo_root / ".env"
_ENV_GSF: Final[Path] = _gsf_dir / ".env"


def _refresh_env_from_files() -> None:
    """Reload ``.env`` files on each connection attempt."""
    load_dotenv(_ENV_REPO, override=True)
    load_dotenv(_ENV_GSF, override=True)


def load_repository_env() -> None:
    """Load repo root ``.env`` then ``gsf/.env`` (later overrides)."""
    _refresh_env_from_files()


def neo4j_settings() -> tuple[str, str, str]:
    """Return ``(uri, user, password)`` from env after loading ``.env`` files."""
    _refresh_env_from_files()
    uri = os.environ.get("NEO4J_URI", "bolt://localhost:7687").strip()
    user = os.environ.get("NEO4J_USERNAME", "neo4j").strip()
    password = os.environ.get("NEO4J_PASSWORD", "").strip()
    return uri, user, password


class Neo4jConnection:
    """Neo4j connection implementation aligned with NeMo-Retriever."""

    def __init__(self, uri: str, username: str, password: str) -> None:
        self._uri = uri
        self._username = username
        self._password = password
        self._driver: Driver | None = None
        try:
            self._driver = GraphDatabase.driver(
                self._uri,
                auth=(self._username, self._password),
                max_connection_lifetime=290,
                liveness_check_timeout=4,
                notifications_min_severity=NotificationMinimumSeverity.OFF,
            )
        except Exception:
            logger.exception("Failed to create the Neo4j driver")
            raise

    @property
    def driver(self) -> Driver:
        if self._driver is None:
            raise RuntimeError("Neo4j driver is not initialized.")
        return self._driver

    def verify_connectivity(self) -> None:
        self.driver.verify_connectivity()

    def close(self) -> None:
        if self._driver is not None:
            self._driver.close()
            self._driver = None

    def __enter__(self) -> Neo4jConnection:
        return self

    def __exit__(self, exc_type: object, exc_val: object, exc_tb: object) -> bool:
        self.close()
        return False

    def query(
        self,
        query: str,
        parameters: dict[str, Any] | None = None,
        routing: RoutingControl = RoutingControl.WRITE,
        ret_type: str = "data",
    ) -> list[dict[str, Any]] | Any:
        try:
            if ret_type == "data":
                records, _, _ = self.driver.execute_query(
                    query,
                    parameters_=parameters,
                    routing_=routing,
                    database_="neo4j",
                )
                return [dict(record) for record in records]
            if ret_type == "graph":
                return self.driver.execute_query(
                    query,
                    parameters_=parameters,
                    routing_=routing,
                    database_="neo4j",
                    result_transformer_=Result.graph,
                )
            raise ValueError(f"Unsupported ret_type: {ret_type}")
        except Exception:
            logger.exception(
                "CYPHER QUERY FAILED: %s, parameters: %s", query, parameters
            )
            raise

    def query_write(
        self, query: str, parameters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        return self.query(query, parameters)

    def query_read(
        self, query: str, parameters: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        return self.query(query, parameters, routing=RoutingControl.READ)

    def query_graph(self, query: str, parameters: dict[str, Any] | None = None) -> Any:
        return self.query(query, parameters, ret_type="graph")


_conn: Neo4jConnection | None = None


def get_neo4j_conn() -> Neo4jConnection:
    """Return the shared Neo4j connection singleton."""
    global _conn
    if _conn is None:
        uri, user, password = neo4j_settings()
        if not password:
            msg = (
                "NEO4J_PASSWORD is not set after loading .env. "
                f"Looked for {_ENV_REPO} (exists={_ENV_REPO.is_file()}), "
                f"{_ENV_GSF} (exists={_ENV_GSF.is_file()}). "
                "Add NEO4J_PASSWORD there or export it before starting uvicorn."
            )
            raise RuntimeError(msg)
        _conn = Neo4jConnection(uri, user, password)
        logger.info("Verifying connectivity for Neo4j")
        _conn.verify_connectivity()
    return _conn


class Neo4jConnectionManager:
    """Compatibility wrapper for existing manager-based callers."""

    def connection(self) -> Neo4jConnection:
        return get_neo4j_conn()

    @property
    def driver(self) -> Driver:
        return get_driver()

    def close(self) -> None:
        close_driver()

    def verify_connectivity(self) -> None:
        self.connection().verify_connectivity()


_manager = Neo4jConnectionManager()


def get_driver() -> Driver:
    """Return the shared Neo4j driver."""
    return get_neo4j_conn().driver


def close_driver() -> None:
    """Close and clear the shared Neo4j connection."""
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


def get_neo4j_manager() -> Neo4jConnectionManager:
    """Return the process-wide Neo4j manager wrapper."""
    return _manager
