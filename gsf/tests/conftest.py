from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def _mock_neo4j():
    """Patch neo4j_db so tests never need a live Neo4j instance."""
    mock_driver = MagicMock()
    mock_session = MagicMock()
    mock_driver.session.return_value.__enter__ = MagicMock(return_value=mock_session)
    mock_driver.session.return_value.__exit__ = MagicMock(return_value=False)

    with patch("server.neo4j_db.get_driver", return_value=mock_driver):
        yield mock_driver, mock_session


@pytest.fixture()
def client(_mock_neo4j):
    """FastAPI TestClient with Neo4j mocked out."""
    from server.main import app

    return TestClient(app)
