import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./apiClient", () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from "./apiClient";
import { buildRepoPrefillPatch, runBootstrap, withPrefilledRepoIds } from "./bootstrap";

describe("bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefills default repo IDs with hf username", () => {
    const patch = buildRepoPrefillPatch(
      {
        record_repo_id: "user/record",
        train_repo_id: "user/train",
        dataset_repo_id: "other/repo",
      },
      "alice",
    );

    expect(patch).toEqual({
      record_repo_id: "alice/record",
      train_repo_id: "alice/train",
    });
  });

  it("returns original config when no prefill patch is needed", () => {
    const config = { record_repo_id: "org/repo" };
    const merged = withPrefilledRepoIds(config, "alice");
    expect(merged).toBe(config);
  });

  it("runs bootstrap and derives sidebar signals from api responses", async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) => {
      if (path === "/api/config") return { record_repo_id: "user/pick" };
      if (path === "/api/devices") return { cameras: [{ device: "video0" }], arms: [] };
      if (path === "/api/deps/status") {
        return {
          ok: true,
          huggingface_cli: false,
          teleop_antijitter_plugin: true,
          rules_needs_root: true,
          rules_needs_install: true,
        };
      }
      if (path === "/api/hf/whoami") return { ok: true, username: "alice" };
      return { ok: false, reason: "missing cuda" };
    });

    const result = await runBootstrap();

    expect(result.hfUsername).toBe("alice");
    expect(result.prefillPatch).toEqual({ record_repo_id: "alice/pick" });
    expect(result.sidebarSignals).toMatchObject({
      hasCameras: true,
      hasArms: false,
      datasetMissingDep: true,
      trainMissingDep: true,
      rulesNeedsRoot: true,
      rulesNeedsInstall: true,
    });
    expect(result.errors).toEqual({});
  });

  it("keeps defaults and reports errors when requests fail", async () => {
    vi.mocked(apiGet).mockImplementation(async (path: string) => {
      if (path === "/api/config") throw new Error("config down");
      if (path === "/api/devices") throw new Error("devices down");
      if (path === "/api/deps/status") throw new Error("deps down");
      if (path === "/api/hf/whoami") return { ok: false, username: null };
      if (path === "/api/train/preflight?device=cuda") throw new Error("preflight down");
      return {};
    });

    const result = await runBootstrap();

    expect(result.config).toEqual({});
    expect(result.devices).toEqual({ cameras: [], arms: [] });
    expect(result.hfUsername).toBeNull();
    expect(result.errors).toMatchObject({
      config: expect.stringContaining("config down"),
      devices: expect.stringContaining("devices down"),
      depsStatus: expect.stringContaining("deps down"),
      trainPreflight: expect.stringContaining("preflight down"),
    });
  });
});
