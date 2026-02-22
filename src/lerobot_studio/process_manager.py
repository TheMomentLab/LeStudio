import os
import queue
import re
import signal
import subprocess
import threading
from pathlib import Path

PROCESS_NAMES = ["teleop", "record", "calibrate", "motor_setup", "train"]
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


class ProcessManager:
    def __init__(self, lerobot_src: Path):
        self.lerobot_src = lerobot_src
        self.procs: dict[str, subprocess.Popen] = {}
        self.out_q: queue.Queue = queue.Queue(maxsize=1000)

    def flush_queue(self, name: str):
        items = []
        while True:
            try:
                item = self.out_q.get_nowait()
                if item["process"] != name:
                    items.append(item)
            except queue.Empty:
                break
        for item in items:
            try:
                self.out_q.put_nowait(item)
            except queue.Full:
                pass

    def start(self, name: str, args: list[str]) -> bool:
        self.stop(name)
        self.flush_queue(name)
        env = {
            **os.environ,
            "PYTHONPATH": str(self.lerobot_src) + ":" + os.environ.get("PYTHONPATH", ""),
            "PYTHONUNBUFFERED": "1",
        }
        try:
            proc = subprocess.Popen(
                args,
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0,
                start_new_session=True,
            )
            self.procs[name] = proc
            threading.Thread(target=self._reader, args=(name, proc), daemon=True).start()
            return True
        except Exception as e:
            self._push(name, f"[ERROR] {e}", "error")
            return False

    def stop(self, name: str):
        proc = self.procs.pop(name, None)
        if proc and proc.poll() is None:
            try:
                pgid = os.getpgid(proc.pid)
            except Exception:
                pgid = None

            try:
                if pgid is not None:
                    os.killpg(pgid, signal.SIGINT)
                else:
                    proc.send_signal(signal.SIGINT)
                proc.wait(timeout=5)
                return
            except subprocess.TimeoutExpired:
                pass

            if pgid is not None:
                try:
                    os.killpg(pgid, signal.SIGTERM)
                except ProcessLookupError:
                    return
            else:
                proc.terminate()

            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                if pgid is not None:
                    try:
                        os.killpg(pgid, signal.SIGKILL)
                    except ProcessLookupError:
                        return
                else:
                    proc.kill()

    def send_input(self, name: str, text: str):
        proc = self.procs.get(name)
        if proc and proc.poll() is None and proc.stdin:
            try:
                proc.stdin.write((text + "\n").encode())
                proc.stdin.flush()
            except Exception:
                pass

    def is_running(self, name: str) -> bool:
        proc = self.procs.get(name)
        return proc is not None and proc.poll() is None

    def status_all(self) -> dict:
        return {n: self.is_running(n) for n in PROCESS_NAMES}

    def _reader(self, name: str, proc: subprocess.Popen):
        import select as sel

        if proc.stdout is None:
            return
        buf = b""
        while True:
            try:
                r, _, _ = sel.select([proc.stdout], [], [], 0.1)
            except Exception:
                break
            if r:
                chunk = proc.stdout.read(256)
                if not chunk:
                    break
                buf += chunk
                while b"\n" in buf:
                    line, buf = buf.split(b"\n", 1)
                    text = _ANSI_RE.sub("", line.decode("utf-8", errors="replace").rstrip("\r"))
                    if text:
                        self._push(name, text, "stdout")
            else:
                if buf:
                    text = _ANSI_RE.sub("", buf.decode("utf-8", errors="replace").rstrip("\r"))
                    if text:
                        self._push(name, text, "stdout")
                    buf = b""
                if proc.poll() is not None:
                    break
        if buf:
            text = _ANSI_RE.sub("", buf.decode("utf-8", errors="replace").rstrip("\r"))
            if text:
                self._push(name, text, "stdout")
        self._push(name, f"[{name} process ended]", "info")

    def _push(self, name: str, line: str, kind: str):
        try:
            self.out_q.put_nowait({"process": name, "line": line, "kind": kind})
        except queue.Full:
            pass
