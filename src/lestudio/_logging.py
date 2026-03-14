"""Centralized logging configuration for LeStudio."""

from __future__ import annotations

import glob
import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

_LOG_MAX_BYTES = 5 * 1024 * 1024  # 5 MB per file
_LOG_BACKUP_COUNT = 3  # keep 3 rotated files
_LOG_EXPIRY_DAYS = 7

_file_handler_installed = False


def _cleanup_old_logs(log_dir: Path) -> None:
    cutoff = time.time() - _LOG_EXPIRY_DAYS * 86400
    for path in glob.glob(str(log_dir / "lestudio.log.*")):
        try:
            if os.path.getmtime(path) < cutoff:
                os.remove(path)
        except OSError:
            pass


def configure_logging(*, level: int = logging.INFO, log_dir: Path | None = None) -> None:
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    root = logging.getLogger("lestudio")
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter(fmt, datefmt=datefmt))
        root.addHandler(handler)

    global _file_handler_installed  # noqa: PLW0603
    if log_dir is not None and not _file_handler_installed:
        log_dir.mkdir(parents=True, exist_ok=True)
        _cleanup_old_logs(log_dir)
        fh = RotatingFileHandler(
            log_dir / "lestudio.log",
            maxBytes=_LOG_MAX_BYTES,
            backupCount=_LOG_BACKUP_COUNT,
        )
        fh.setFormatter(logging.Formatter(fmt, datefmt=datefmt))
        root.addHandler(fh)
        _file_handler_installed = True
        root.info(
            "file logging enabled → %s (max %dMB × %d, expiry %dd)",
            log_dir / "lestudio.log",
            _LOG_MAX_BYTES // (1024 * 1024),
            _LOG_BACKUP_COUNT,
            _LOG_EXPIRY_DAYS,
        )

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
