import argparse
import logging
import sys
from pathlib import Path

# The udev installer and the serve helpers live in lerobot_doctor; the names
# stay importable from here for existing callers and tests.
from lerobot_doctor.cli import _extract_symlink_names, _manual_commands, install_udev_rules  # noqa: F401
from lerobot_doctor.serve import (  # noqa: F401
    DEFAULT_RULES_PATH,
    find_lerobot_src,
    get_local_ip,
    maybe_open_browser,
    open_browser,
    print_banner,
    resolve_config_dir,
    resolve_lerobot_src,
    run_uvicorn,
)

logger = logging.getLogger(__name__)


def command_serve(args):
    lerobot_src = resolve_lerobot_src(args.lerobot_path)
    config_dir = resolve_config_dir(args.config_dir)

    from lerobot_doctor._auth import generate_token
    from lestudio.server import create_app

    token = generate_token()
    app = create_app(
        lerobot_src=lerobot_src,
        config_dir=config_dir,
        rules_path=args.rules_path,
        session_token=token,
    )

    print_banner(
        "LeStudio",
        _version(),
        lerobot_src=lerobot_src,
        config_dir=config_dir,
        host=args.host,
        port=args.port,
        token=token,
    )
    maybe_open_browser(args.browser and not args.headless, args.port)
    run_uvicorn(
        app,
        host=args.host,
        port=args.port,
        reload=getattr(args, "reload", False),
        reload_factory="lestudio.server:create_app_from_env",
        reload_env={
            "_LESTUDIO_LEROBOT_SRC": str(lerobot_src),
            "_LESTUDIO_CONFIG_DIR": str(config_dir),
            "_LESTUDIO_RULES_PATH": str(args.rules_path),
            "_LESTUDIO_TOKEN": token,
        },
        reload_dirs=[str(Path(__file__).parent)],
    )


def command_install_udev(args):
    config_dir = resolve_config_dir(args.config_dir)
    source_rules = args.source_rules if args.source_rules is not None else (config_dir / "99-lerobot.rules")
    code = install_udev_rules(source_rules, args.rules_path, dry_run=args.dry_run)
    if code != 0:
        sys.exit(code)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lestudio",
        description="LeStudio",
    )
    sub = parser.add_subparsers(dest="command")

    serve = sub.add_parser("serve", help="Run LeStudio web server")
    serve.add_argument("--port", type=int, default=7860, help="Server port (default: 7860)")
    serve.add_argument("--host", default="127.0.0.1", help="Server host (default: 127.0.0.1)")
    serve.add_argument(
        "--lerobot-path", type=Path, default=None, help="Path to lerobot source (auto-detected if installed)"
    )
    serve.add_argument("--config-dir", type=Path, default=None, help="Config directory (default: ~/.config/lestudio)")
    serve.add_argument("--rules-path", type=Path, default=DEFAULT_RULES_PATH, help="Path to udev rules file")
    serve.add_argument("--browser", action="store_true", help="Open a browser automatically on startup")
    serve.add_argument(
        "--no-browser", action="store_true", help="(deprecated, no-op) Browser is no longer opened automatically"
    )
    serve.add_argument("--headless", action="store_true", help="Alias for --no-browser")
    serve.add_argument("--reload", action="store_true", help="Enable auto-reload on Python file changes (dev mode)")
    serve.set_defaults(handler=command_serve)

    install = sub.add_parser("install-udev", help="Install udev rules with sudo (separate from web UI)")
    install.add_argument(
        "--config-dir", type=Path, default=None, help="Config directory (default: ~/.config/lestudio)"
    )
    install.add_argument(
        "--source-rules", type=Path, default=None, help="Source rules file (default: <config-dir>/99-lerobot.rules)"
    )
    install.add_argument(
        "--rules-path",
        type=Path,
        default=DEFAULT_RULES_PATH,
        help="Target rules file (default: /etc/udev/rules.d/99-lerobot.rules)",
    )
    install.add_argument("--dry-run", action="store_true", help="Print commands only without applying")
    install.set_defaults(handler=command_install_udev)

    return parser


def main():
    parser = build_parser()
    argv = sys.argv[1:]
    if not argv:
        argv = ["serve", *argv]
    elif argv[0].startswith("-") and argv[0] not in {"-h", "--help"}:
        argv = ["serve", *argv]
    args = parser.parse_args(argv)
    if not hasattr(args, "handler"):
        parser.print_help()
        sys.exit(2)
    args.handler(args)


def _version() -> str:
    from lestudio import __version__

    return __version__
