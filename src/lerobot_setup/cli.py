import argparse
import sys
from pathlib import Path


def find_lerobot_src() -> Path | None:
    try:
        import lerobot
        if hasattr(lerobot, "__file__") and lerobot.__file__ is not None:
            return Path(lerobot.__file__).parent
    except ImportError:
        pass

    for candidate in [
        Path.cwd() / "src" / "lerobot",
        Path.cwd() / "lerobot" / "src" / "lerobot",
        Path.cwd() / "reference" / "lerobot" / "src",
    ]:
        if candidate.is_dir():
            return candidate.parent
    return None


def main():
    parser = argparse.ArgumentParser(
        prog="lerobot-setup",
        description="Web-based setup tool for LeRobot robots",
    )
    parser.add_argument(
        "--port", type=int, default=7860,
        help="Server port (default: 7860)",
    )
    parser.add_argument(
        "--host", default="0.0.0.0",
        help="Server host (default: 0.0.0.0)",
    )
    parser.add_argument(
        "--lerobot-path", type=Path, default=None,
        help="Path to lerobot source (auto-detected if installed)",
    )
    parser.add_argument(
        "--config-dir", type=Path, default=None,
        help="Config directory (default: ~/.config/lerobot-setup)",
    )
    parser.add_argument(
        "--rules-path", type=Path, default=Path("/etc/udev/rules.d/99-lerobot.rules"),
        help="Path to udev rules file",
    )
    args = parser.parse_args()

    lerobot_src = args.lerobot_path
    if lerobot_src is None:
        lerobot_src = find_lerobot_src()
    if lerobot_src is None:
        print("ERROR: Cannot find lerobot source.", file=sys.stderr)
        print("Install lerobot (`pip install lerobot`) or pass --lerobot-path", file=sys.stderr)
        sys.exit(1)

    lerobot_src = lerobot_src.resolve()
    if not lerobot_src.is_dir():
        print(f"ERROR: --lerobot-path does not exist: {lerobot_src}", file=sys.stderr)
        sys.exit(1)

    config_dir = args.config_dir or Path.home() / ".config" / "lerobot-setup"
    config_dir.mkdir(parents=True, exist_ok=True)

    from lerobot_setup.server import create_app
    import uvicorn

    app = create_app(
        lerobot_src=lerobot_src,
        config_dir=config_dir,
        rules_path=args.rules_path,
    )

    print(f"🤖  LeRobot Setup Tool v{_version()}")
    print(f"    lerobot: {lerobot_src}")
    print(f"    config:  {config_dir}")
    print(f"    Open:    http://localhost:{args.port}\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


def _version() -> str:
    from lerobot_setup import __version__
    return __version__
