import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from "sonner";
import {
  notifyDesktop,
  notifyProcessCompleted,
  notifyProcessEndedWithError,
  notifyProcessStarted,
  notifyProcessStopRequested,
  requestDesktopNotificationPermission,
} from "./notifications";

type NotificationCtor = {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  new (title: string, options?: NotificationOptions): { onclick: (() => void) | null };
};

type NotificationInstance = {
  title: string;
  options?: NotificationOptions;
};

describe("notifications", () => {
  let baseTime = Date.parse("2026-03-15T10:00:00Z");
  const instances: NotificationInstance[] = [];
  const focus = vi.fn();
  const requestPermission = vi.fn<() => Promise<NotificationPermission>>();

  class FakeNotification {
    static permission: NotificationPermission = "granted";
    static requestPermission = requestPermission;
    onclick: (() => void) | null = null;

    constructor(title: string, options?: NotificationOptions) {
      instances.push({ title, options });
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    baseTime += 6000;
    vi.setSystemTime(baseTime);
    instances.length = 0;
    requestPermission.mockResolvedValue("granted");
    FakeNotification.permission = "granted";

    Object.defineProperty(globalThis, "window", {
      value: { focus, Notification: FakeNotification },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "Notification", {
      value: FakeNotification as unknown as NotificationCtor,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "Notification");
  });

  it("requests desktop notification permission only when permission is default", () => {
    FakeNotification.permission = "default";
    requestDesktopNotificationPermission();
    expect(requestPermission).toHaveBeenCalledTimes(1);

    FakeNotification.permission = "granted";
    requestDesktopNotificationPermission();
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("throttles duplicate desktop notifications within cooldown", () => {
    notifyDesktop("LeStudio", "Train completed.", "proc-train-complete");
    notifyDesktop("LeStudio", "Train completed.", "proc-train-complete");
    expect(instances).toHaveLength(1);

    vi.advanceTimersByTime(5001);
    notifyDesktop("LeStudio", "Train completed.", "proc-train-complete");
    expect(instances).toHaveLength(2);
  });

  it("sends process lifecycle toasts", () => {
    notifyProcessStarted("teleop");
    notifyProcessStopRequested("record");
    expect(toast.success).toHaveBeenCalledWith("Teleop started");
    expect(toast.info).toHaveBeenCalledWith("Record stop requested");
  });

  it("notifies completion for train", () => {
    notifyProcessCompleted("train");

    expect(toast.success).toHaveBeenCalledWith("Train completed.");
    expect(instances).toHaveLength(1);
    expect(instances[0]).toMatchObject({
      title: "LeStudio",
      options: { body: "Train completed.", tag: "proc-train-complete", silent: false },
    });
  });

  it("notifies completion for record", () => {
    notifyProcessCompleted("record");

    expect(toast.info).toHaveBeenCalledWith("Record session ended.");
    expect(instances).toHaveLength(1);
    expect(instances[0]?.options?.tag).toBe("proc-record-end");
  });

  it("notifies process errors with optional toast suppression", () => {
    notifyProcessEndedWithError("eval", "Eval failed");
    notifyProcessEndedWithError("train", undefined, { toast: false });

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Eval failed");
    expect(instances).toHaveLength(2);
    expect(instances[0]?.options?.body).toBe("eval ended with error. Check logs.");
    expect(instances[1]?.options?.tag).toBe("proc-train-error");
  });
});
