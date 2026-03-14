# pyright: reportMissingImports=false

"""Tests for TokenAuthMiddleware and related auth helpers."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

from lestudio.server import create_app
from lestudio._auth import (
    generate_token,
    _is_localhost,
    _needs_auth,
)
from lestudio.routes import config as _config_routes
from lestudio.routes import process as _process_routes


# ─── Helper ────────────────────────────────────────────────────────────────────


def _make_app(tmp_path: Path, token: str = "test-token-abc"):
    lerobot_src = tmp_path / "lerobot_src"
    (lerobot_src / "lerobot").mkdir(parents=True)
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    rules_path = tmp_path / "99-lerobot.rules"
    return create_app(
        lerobot_src=lerobot_src,
        config_dir=config_dir,
        rules_path=rules_path,
        session_token=token,
    )


def _mock_request(host: str, method: str = "POST", path: str = "/api/process/foo/stop"):
    req = MagicMock()
    req.client = MagicMock()
    req.client.host = host
    req.method = method
    req.url = MagicMock()
    req.url.path = path
    return req


# ─── generate_token ────────────────────────────────────────────────────────────


def test_generate_token_returns_64_hex_chars():
    t = generate_token()
    assert len(t) == 64
    assert all(c in "0123456789abcdef" for c in t)


def test_generate_token_honours_env_var(monkeypatch):
    monkeypatch.setenv("LESTUDIO_TOKEN", "my-stable-token")
    assert generate_token() == "my-stable-token"


def test_generate_token_unique():
    tokens = {generate_token() for _ in range(20)}
    assert len(tokens) == 20


# ─── _is_localhost ─────────────────────────────────────────────────────────────


def test_is_localhost_ipv4():
    assert _is_localhost(_mock_request("127.0.0.1")) is True


def test_is_localhost_ipv6():
    assert _is_localhost(_mock_request("::1")) is True


def test_is_localhost_external():
    assert _is_localhost(_mock_request("192.168.1.10")) is False


# ─── _needs_auth ───────────────────────────────────────────────────────────────


def test_needs_auth_localhost_exempt():
    req = _mock_request("127.0.0.1", "POST", "/api/process/foo/stop")
    assert _needs_auth(req) is False


def test_needs_auth_ipv6_localhost_exempt():
    req = _mock_request("::1", "POST", "/api/record/start")
    assert _needs_auth(req) is False


def test_needs_auth_safe_method_exempt():
    req = _mock_request("192.168.1.10", "GET", "/api/process/foo/status")
    assert _needs_auth(req) is False


def test_needs_auth_external_protected():
    req = _mock_request("192.168.1.10", "POST", "/api/process/foo/stop")
    assert _needs_auth(req) is True


def test_needs_auth_external_teleop():
    req = _mock_request("10.0.0.5", "POST", "/api/teleop/start")
    assert _needs_auth(req) is True


def test_needs_auth_external_config_mutation_protected():
    req = _mock_request("192.168.1.10", "POST", "/api/config")
    assert _needs_auth(req) is True


# ─── session_token on app.state ────────────────────────────────────────────────


def test_session_token_stored_on_app_state(tmp_path: Path):
    """create_app stores the session token on app.state.session_token."""
    app = _make_app(tmp_path, token="my-token-xyz")
    assert app.state.session_token == "my-token-xyz"
