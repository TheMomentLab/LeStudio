import { describe, expect, it } from "vitest";

import {
  buildHubSearchPath,
  extractPreflightReason,
  fromBackendDatasetList,
  fromBackendResources,
  normalizeCheckpointStep,
  normalizeDeviceKey,
  parseBackendError,
} from "./contracts";

describe("contracts utilities", () => {
  it("normalizes device labels to backend keys", () => {
    expect(normalizeDeviceKey("CUDA (GPU)")).toBe("cuda");
    expect(normalizeDeviceKey("CPU")).toBe("cpu");
    expect(normalizeDeviceKey("Apple MPS")).toBe("mps");
  });

  it("extracts preflight reasons from explicit reason or checks", () => {
    expect(extractPreflightReason({ ok: false, reason: "manual reason" })).toBe("manual reason");
    expect(
      extractPreflightReason({
        ok: false,
        checks: [{ status: "error", label: "camera_path", msg: "missing camera path" }],
      }),
    ).toBe("missing camera path");
    expect(
      extractPreflightReason({
        ok: false,
        checks: [{ status: "warn", label: "cuda", msg: "cuda warmup slow" }],
      }),
    ).toBe("cuda warmup slow");
    expect(extractPreflightReason({ ok: false })).toBe("preflight failed");
  });

  it("maps backend resource payload and converts MB to rounded GB", () => {
    const mapped = fromBackendResources({
      cpu_percent: 25,
      ram_used_mb: 2048,
      ram_total_mb: 8192,
      disk_used_gb: 100,
      disk_total_gb: 250,
      lerobot_cache_mb: 1536,
    });

    expect(mapped).toEqual({
      cpu_percent: 25,
      ram_used: 2,
      ram_total: 8,
      disk_used: 100,
      disk_total: 250,
      cache_size: 1.5,
    });
  });

  it("maps dataset list and ignores invalid entries", () => {
    const mapped = fromBackendDatasetList({
      datasets: [
        { id: "user/pick", total_episodes: 4, total_frames: 100, size_mb: 512, tags: ["cam1"] },
        { total_episodes: 2 },
      ],
    });

    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      id: "user/pick",
      episodes: 4,
      frames: 100,
      size: "512.0 MB",
      tags: ["cam1"],
    });
  });

  it("builds hub search query with encoded params", () => {
    const path = buildHubSearchPath("pick cube", 10);
    expect(path).toContain("/api/hub/datasets/search?");
    expect(path).toContain("query=pick+cube");
    expect(path).toContain("limit=10");
    expect(path).toContain("tag=lerobot");
  });

  it("normalizes checkpoint steps and backend errors", () => {
    expect(normalizeCheckpointStep(1200)).toBe(1200);
    expect(normalizeCheckpointStep("2400")).toBe(2400);
    expect(normalizeCheckpointStep("bad")).toBeNull();
    expect(parseBackendError(new Error("boom"), "fallback")).toBe("boom");
    expect(parseBackendError(null, "fallback")).toBe("fallback");
  });
});
