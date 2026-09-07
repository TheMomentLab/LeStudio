"""Route-introspection helpers shared by the server tests.

FastAPI >= 0.13x no longer flattens ``include_router`` into ``app.routes``;
each included router shows up as a single ``_IncludedRouter`` wrapper whose
concrete routes live on ``original_router``. Walk that structure so the tests
see the same leaf routes on both old and new FastAPI versions.
"""
from __future__ import annotations

from collections.abc import Iterator
from typing import Any


def iter_routes(app_or_router: Any) -> Iterator[Any]:
    """Yield every leaf route reachable from ``app_or_router``, depth-first."""
    for route in getattr(app_or_router, "routes", []):
        nested = getattr(route, "original_router", None)
        if nested is not None:
            yield from iter_routes(nested)
        else:
            yield route


def find_endpoint(app: Any, path: str, method: str) -> Any:
    method = method.upper()
    for route in iter_routes(app):
        if getattr(route, "path", None) != path:
            continue
        methods = getattr(route, "methods", set()) or set()
        if method in methods:
            return route.endpoint
    raise AssertionError(f"Route not found: {method} {path}")
