import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from "sonner";
import {
  applySidebarSignalsPatch,
  getLeStudioState,
  mapActiveTabToPath,
  mapPathnameToActiveTab,
  resetLeStudioState,
} from "./index";

describe("store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLeStudioState();
  });

  it("maps pathname and active tabs consistently", () => {
    expect(mapPathnameToActiveTab("/train/settings")).toBe("train");
    expect(mapPathnameToActiveTab("/unknown")).toBe("status");
    expect(mapActiveTabToPath("record")).toBe("/record");
    expect(mapActiveTabToPath("status")).toBe("/");
  });

  it("updates active tab and ignores invalid updates", () => {
    const state = getLeStudioState();
    state.setActiveTab("record");
    expect(getLeStudioState().activeTab).toBe("record");

    const invalidTab = "invalid-tab" as "status";
    state.setActiveTab(invalidTab);
    expect(getLeStudioState().activeTab).toBe("record");
  });

  it("appends logs and replaces entries when replace key matches", () => {
    const state = getLeStudioState();
    state.appendLog("record", "first", "info", "ep-progress");
    state.appendLog("record", "second", "warn", "ep-progress");

    const lines = getLeStudioState().logLines.record;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ text: "second", kind: "warn", replace: "ep-progress" });
  });

  it("adds and removes toasts and calls sonner", () => {
    const state = getLeStudioState();
    state.addToast("saved", "success");

    const [firstToast] = getLeStudioState().toasts;
    expect(firstToast.message).toBe("saved");
    expect(toast.success).toHaveBeenCalledWith("saved");

    state.removeToast(firstToast.id);
    expect(getLeStudioState().toasts).toHaveLength(0);
  });

  it("merges sidebar signal patches", () => {
    applySidebarSignalsPatch({ hasCameras: false, rulesNeedsInstall: true });

    expect(getLeStudioState().sidebarSignals).toMatchObject({
      hasCameras: false,
      rulesNeedsInstall: true,
    });
  });
});
