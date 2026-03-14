"""udev rules management helpers."""

from __future__ import annotations

import logging
import os
import re
import shlex
import shutil
import subprocess
from pathlib import Path

from lestudio import path_policy

logger = logging.getLogger(__name__)


def _parse_udev_rules(content: str) -> dict[str, list[dict[str, str | bool]]]:
    camera_rules: list[dict[str, str | bool]] = []
    arm_rules: list[dict[str, str | bool]] = []
    devices: list[dict[str, str | bool]] = []

    def _extract(pattern: str, text: str) -> str:
        match = re.search(pattern, text)
        if not match:
            return ""
        return match.group(1)

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "SYMLINK" not in line:
            continue

        subsystem = _extract(r'SUBSYSTEM=="([^"]+)"', line)
        kernels = _extract(r'KERNELS=="([^"]+)"', line)
        serial = _extract(r'ATTRS\{serial\}=="([^"]+)"', line)
        symlink = _extract(r'SYMLINK\+="([^"]+)"', line)
        mode = _extract(r'MODE="([^"]+)"', line)

        if not symlink:
            continue

        exists = os.path.exists(f"/dev/{symlink}")
        item = {
            "subsystem": subsystem,
            "kernel": kernels,
            "serial": serial,
            "symlink": symlink,
            "mode": mode,
            "exists": exists,
        }
        devices.append(item)
        if subsystem == "video4linux":
            camera_rules.append(item)
        elif subsystem == "tty":
            arm_rules.append(item)

    return {
        "camera_rules": camera_rules,
        "arm_rules": arm_rules,
        "devices": devices,
    }


def _build_rules(assignments: dict[str, str], arm_assignments: dict[str, str], rules_path: Path) -> str:
    # NOTE: arm_assignments is the complete desired arm state.
    # Do NOT merge with _arm_rule_lines(rules_path) — that caused stale/duplicate
    # arm rules to persist across applies, leading to conflicting udev symlinks.
    lines = [
        "# LeRobot Camera Rules",
        '# Note: Cameras share Serial "SN0001", so we use physical port paths (KERNELS).',
        "# If you plug cameras into different ports, you MUST update these paths!",
        "",
    ]
    for kernels, role in sorted(assignments.items()):
        if role and role != "(none)":
            lines.append(
                f'SUBSYSTEM=="video4linux", KERNELS=="{kernels}", ATTR{{index}}=="0", SYMLINK+="{role}", MODE="0666"'
            )

    lines += [
        "",
        "# LeRobot Arm Rules",
        "# Arms use serial-number matching.",
        "",
    ]
    for serial, role in sorted(arm_assignments.items()):
        if serial and role and role != "(none)":
            lines.append(f'SUBSYSTEM=="tty", ATTRS{{serial}}=="{serial}", SYMLINK+="{role}", MODE="0666"')

    active_cams = {k: v for k, v in assignments.items() if v and v != "(none)"}
    active_arms = {k: v for k, v in arm_assignments.items() if v and v != "(none)"}
    logger.debug("_build_rules result: cameras=%s, arms=%s, total_lines=%d", active_cams, active_arms, len(lines))

    return "\n".join(lines) + "\n"


def _apply_rules(assignments: dict[str, str], arm_assignments: dict[str, str], rules_path: Path) -> tuple[bool, str]:
    return _apply_rules_with_fallback(assignments, arm_assignments, rules_path, None)


def _manual_udev_install_commands(source_rules: Path, target_rules: Path) -> list[str]:
    source_q = shlex.quote(str(source_rules))
    target_q = shlex.quote(str(target_rules))
    return [
        f"sudo cp {source_q} {target_q}",
        "sudo udevadm control --reload-rules",
        "sudo udevadm trigger --subsystem-match=video4linux",
        "sudo udevadm trigger --subsystem-match=tty",
    ]


_SUDOERS_DROP_IN = Path("/etc/sudoers.d/lestudio-udev")

_SUDOERS_COMMANDS = (
    "/usr/bin/cp",
    "/usr/bin/udevadm",
    "/bin/cp",
    "/bin/udevadm",
)


def _sudoers_install_snippet() -> str:
    """Shell snippet that installs the sudoers drop-in for the invoking user.

    Security-relevant: grants NOPASSWD only for cp and udevadm — the minimal
    set required for udev rule management.  The snippet is a no-op when the
    file already exists.
    """
    user = os.environ.get("USER") or "root"
    cmds = ", ".join(_SUDOERS_COMMANDS)
    content = f"{user} ALL=(root) NOPASSWD: {cmds}\\n"
    drop_in_q = shlex.quote(str(_SUDOERS_DROP_IN))
    return f"test -f {drop_in_q} || {{ printf '{content}' > {drop_in_q} && chmod 0440 {drop_in_q}; }}"


def _udev_steps(source_rules: Path, target_rules: Path) -> list[list[str]]:
    return [
        ["cp", str(source_rules), str(target_rules)],
        ["udevadm", "control", "--reload-rules"],
        ["udevadm", "trigger", "--subsystem-match=video4linux"],
        ["udevadm", "trigger", "--subsystem-match=tty"],
        ["udevadm", "settle", "--timeout=5"],
    ]


def _run_privileged_udev_apply_sequential(
    source_rules: Path,
    target_rules: Path,
) -> tuple[bool, str]:
    for step in _udev_steps(source_rules, target_rules):
        cmd = ["sudo", "-n", *step]
        logger.debug("sudo-n step: %s", cmd)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "").strip()
            logger.warning("sudo-n step failed (%s): %s", step[0], err)
            return False, err or f"sudo -n {step[0]} failed"
        logger.debug("sudo-n step ok: %s (rc=%d)", step[0], result.returncode)
    logger.info("udev rules applied via sudo -n (sequential)")
    return True, ""


def _run_privileged_udev_apply_pkexec(
    source_rules: Path,
    target_rules: Path,
    *,
    install_sudoers: bool = False,
) -> tuple[bool, str]:
    source_q = shlex.quote(str(source_rules))
    target_q = shlex.quote(str(target_rules))
    chained = (
        f"cp {source_q} {target_q} && "
        "udevadm control --reload-rules && "
        "udevadm trigger --subsystem-match=video4linux && "
        "udevadm trigger --subsystem-match=tty && "
        "udevadm settle --timeout=5"
    )
    if install_sudoers:
        chained += f" && {_sudoers_install_snippet()}"
    command = ["pkexec", "sh", "-c", chained]
    logger.debug("pkexec chain: %s", command)
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        err = stderr or stdout or "pkexec privileged udev apply failed"
        logger.warning("pkexec failed (rc=%d): %s", result.returncode, err)
        return False, err
    logger.info("udev rules applied via pkexec (sudoers drop-in %s)", "installed" if install_sudoers else "skipped")
    return True, ""


def _apply_rules_with_fallback(
    assignments: dict[str, str],
    arm_assignments: dict[str, str],
    rules_path: Path,
    fallback_rules_path: Path | None,
) -> tuple[bool, str]:
    content = _build_rules(assignments, arm_assignments, rules_path)
    tmp = path_policy.temp_rules_path()
    tmp.write_text(content)
    active_arms = sum(1 for v in arm_assignments.values() if v and v != "(none)")
    logger.info(
        "applying udev rules → %s (cameras=%d, arms=%d active/%d total, sudoers_exists=%s)",
        rules_path,
        len(assignments),
        active_arms,
        len(arm_assignments),
        _SUDOERS_DROP_IN.exists(),
    )

    if fallback_rules_path is not None:
        try:
            fallback_rules_path.parent.mkdir(parents=True, exist_ok=True)
            fallback_rules_path.write_text(content)
        except OSError:
            pass

    try:
        sudo_ok, sudo_err = _run_privileged_udev_apply_sequential(tmp, rules_path)
        if sudo_ok:
            return True, ""

        pkexec_err = ""
        if shutil.which("pkexec"):
            need_sudoers = not _SUDOERS_DROP_IN.exists()
            pkexec_ok, pkexec_err = _run_privileged_udev_apply_pkexec(
                tmp,
                rules_path,
                install_sudoers=need_sudoers,
            )
            if pkexec_ok:
                return True, ""

        base_err = sudo_err or "sudo failed — install udev rules via CLI helper"
        if pkexec_err:
            base_err = f"{base_err}\npkexec failed: {pkexec_err}"

        if fallback_rules_path is None:
            return False, base_err
        commands = _manual_udev_install_commands(fallback_rules_path, rules_path)
        hint = "\n".join(commands)
        return False, (f"{base_err}\n\nSaved rules to: {fallback_rules_path}\nRun these commands:\n{hint}")
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
