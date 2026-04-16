"""Environment bootstrap helpers for server integrations."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from nemo_retriever.tabular_data.neo4j import get_neo4j_conn

_server_dir = Path(__file__).resolve().parent
_gsf_dir = _server_dir.parent
_repo_root = _gsf_dir.parent


def load_server_env() -> None:
    """Load repo and app ``.env`` files into process environment."""
    load_dotenv(_repo_root / ".env", override=True)
    load_dotenv(_gsf_dir / ".env", override=True)


def get_nemo_neo4j_conn():
    """Return NeMo Neo4j connection after ensuring env variables are loaded."""
    load_server_env()
    return get_neo4j_conn()
