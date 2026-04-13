"""Lazy import helper for nemo_retriever submodules.

The top-level ``nemo_retriever`` package eagerly imports heavy dependencies
(torch, ray, vllm …) that our lightweight FastAPI server does not need.
This module stubs the parent packages so we can import *only* the leaf
modules we care about — ``nemo_retriever.tabular_data.sql_database``.
"""

from __future__ import annotations

import sys
import types

_STUBS_INSTALLED = False


def _ensure_stubs() -> None:
    global _STUBS_INSTALLED  # noqa: PLW0603
    if _STUBS_INSTALLED:
        return

    try:
        import importlib.util

        spec = importlib.util.find_spec("nemo_retriever")
    except (ModuleNotFoundError, ValueError):
        spec = None

    if spec is None:
        raise ImportError(
            "nemo-retriever is not installed. "
            "Run: uv pip install --no-deps "
            '"nemo-retriever @ git+https://github.com/NVIDIA/NeMo-Retriever.git'
            '#subdirectory=nemo_retriever"'
        )

    pkg_path = spec.submodule_search_locations
    if pkg_path is None:
        raise ImportError("nemo_retriever has no search path — broken install?")

    # Stub the parent packages so Python skips their __init__.py
    for name, sub in [
        ("nemo_retriever", list(pkg_path)),
        ("nemo_retriever.tabular_data", [f"{pkg_path[0]}/tabular_data"]),
    ]:
        if name not in sys.modules:
            stub = types.ModuleType(name)
            stub.__path__ = sub  # type: ignore[attr-defined]
            sys.modules[name] = stub

    _STUBS_INSTALLED = True


def get_sql_database_class() -> type:
    """Return ``nemo_retriever.tabular_data.sql_database.SQLDatabase``."""
    _ensure_stubs()
    from nemo_retriever.tabular_data.sql_database import SQLDatabase  # type: ignore[import-untyped]

    return SQLDatabase
