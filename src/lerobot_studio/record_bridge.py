#!/usr/bin/env python3

import sys
import threading


def _install_stdin_bridge():
    from lerobot.scripts import lerobot_record as record_mod
    from lerobot.utils import control_utils

    original = control_utils.init_keyboard_listener

    def patched_init_keyboard_listener():
        listener, events = original()

        def read_stdin():
            while True:
                line = sys.stdin.readline()
                if line == "":
                    break
                cmd = line.strip().lower()
                if cmd in {"right", "save", "next", "->"}:
                    events["exit_early"] = True
                elif cmd in {"left", "discard", "rerecord", "<-"}:
                    events["rerecord_episode"] = True
                    events["exit_early"] = True
                elif cmd in {"escape", "esc", "stop", "end"}:
                    events["stop_recording"] = True
                    events["exit_early"] = True

        threading.Thread(target=read_stdin, daemon=True).start()
        return listener, events

    control_utils.init_keyboard_listener = patched_init_keyboard_listener
    record_mod.init_keyboard_listener = patched_init_keyboard_listener
    return record_mod


def main():
    record_mod = _install_stdin_bridge()
    record_mod.main()


if __name__ == "__main__":
    main()
