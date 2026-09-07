"""Session token authentication middleware for LeStudio.

Design intent
-------------
LeStudio is primarily a local-only tool (default bind: 127.0.0.1).
When exposed on a LAN (--host 0.0.0.0), a lightweight token guard prevents
unauthenticated access to sensitive process-control APIs.

Rules
-----
- Requests arriving from localhost (127.0.0.1 / ::1) are bypassed unconditionally.
- All other origins must supply a valid ``X-LeStudio-Token`` header.
- Safe HTTP methods (GET, HEAD, OPTIONS) and non-sensitive paths are exempt.
- A random 32-byte hex token is generated at server start and printed to stdout.
"""

from __future__ import annotations

import logging
import os
import secrets

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from .capabilities import requires_protection

logger = logging.getLogger(__name__)

# Methods that never mutate state — always exempt
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

_LOCALHOST_ADDRS = {"127.0.0.1", "::1", "localhost"}


def _is_localhost(request: Request) -> bool:
    client = request.client
    if client is None:
        return False
    host = client.host or ""
    return host in _LOCALHOST_ADDRS


def _needs_auth(request: Request) -> bool:
    """Return True if the request requires token authentication."""
    if _is_localhost(request):
        return False
    if request.method in _SAFE_METHODS:
        return False
    return requires_protection(request.url.path)


class TokenAuthMiddleware(BaseHTTPMiddleware):
    """Reject non-localhost mutation requests that lack a valid session token."""

    def __init__(self, app: ASGIApp, token: str) -> None:
        super().__init__(app)
        self._token = token

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if _needs_auth(request):
            provided = request.headers.get("X-LeStudio-Token", "")
            if not secrets.compare_digest(provided, self._token):
                return JSONResponse(
                    {"ok": False, "error": "Unauthorized. Provide a valid X-LeStudio-Token header."},
                    status_code=401,
                )
        return await call_next(request)


def generate_token() -> str:
    """Generate a cryptographically random session token.

    Honours the ``LESTUDIO_TOKEN`` environment variable so that operators can
    inject a stable token in managed deployments.
    """
    env_token = os.environ.get("LESTUDIO_TOKEN", "").strip()
    return env_token if env_token else secrets.token_hex(32)
