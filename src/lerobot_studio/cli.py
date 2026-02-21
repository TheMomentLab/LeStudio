import argparse
import sys
from pathlib import Path


def find_lerobot_src() -> Path | None:
    try:
        import lerobot
        module_file = getattr(lerobot, "__file__", None)
        if isinstance(module_file, str) and module_file:
            return Path(module_file).parent
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
        prog="lerobot-studio",
        description="LeRobot Studio",
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
        help="Config directory (default: ~/.config/lerobot-studio)",
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

    if args.config_dir is not None:
        config_dir = args.config_dir
    else:
        new_default = Path.home() / ".config" / "lerobot-studio"
        moment_default = Path.home() / ".config" / "moment-lerobot-studio"
        legacy_default = Path.home() / ".config" / "lerobot-setup"
        if new_default.exists():
            config_dir = new_default
        elif moment_default.exists():
            config_dir = moment_default
        elif legacy_default.exists():
            config_dir = legacy_default
        else:
            config_dir = new_default
    config_dir.mkdir(parents=True, exist_ok=True)

    from lerobot_studio.server import create_app
    import uvicorn

    app = create_app(
        lerobot_src=lerobot_src,
        config_dir=config_dir,
        rules_path=args.rules_path,
    )

    print(f"🤖  LeRobot Studio v{_version()}")
    print(f"    lerobot: {lerobot_src}")
    print(f"    config:  {config_dir}")
    print(f"    Open:    http://localhost:{args.port}\n")

    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


def _version() -> str:
    from lerobot_studio import __version__
    return __version__
