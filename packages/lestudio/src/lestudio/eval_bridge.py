"""Run ``lerobot-eval`` with LeStudio's robot and teleoperator families registered.

Upstream ``lerobot_eval`` only registers the robot configs that the selected
gym environment happens to import (``gym_manipulator`` pulls in the single-arm
SO-100 / SO-101 followers). Bimanual and OMX evaluation needs the other
families registered before draccus parses ``--env.robot.type`` /
``--env.teleop.type``, so this entry point imports them first and then hands
off to the upstream script unchanged.
"""

import importlib

# Robot / teleoperator families LeStudio can launch. Missing modules are
# skipped so older lerobot releases without a family keep working.
_REGISTRY_MODULES = (
    "lerobot.robots.so_follower",
    "lerobot.robots.bi_so_follower",
    "lerobot.robots.omx_follower",
    "lerobot.teleoperators.so_leader",
    "lerobot.teleoperators.bi_so_leader",
    "lerobot.teleoperators.omx_leader",
)


def register_device_families() -> list[str]:
    """Import every known family; return the module names that loaded."""
    loaded: list[str] = []
    try:
        importlib.import_module("lerobot.utils.import_utils").register_third_party_plugins()
    except (ImportError, AttributeError):
        pass
    for module_name in _REGISTRY_MODULES:
        try:
            importlib.import_module(module_name)
        except ImportError:
            continue
        loaded.append(module_name)
    return loaded


def main() -> None:
    register_device_families()
    eval_mod = importlib.import_module("lerobot.scripts.lerobot_eval")
    eval_mod.main()


if __name__ == "__main__":
    main()
