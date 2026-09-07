import { beforeEach, describe, expect, it } from "vitest";

import { handleMockDelete, handleMockGet, handleMockPost, subscribeMockProcessStatus } from "./handlers";

describe("mock handlers OMX flow", () => {
  beforeEach(async () => {
    await handleMockPost("/api/config", {
      robot_type: "so101_follower",
      teleop_type: "so101_leader",
      robot_id: "follower_arm_1",
      teleop_id: "leader_arm_1",
    });
  });

  it("exposes OMX in mock robot and teleop type lists", async () => {
    const robots = await handleMockGet("/api/robots") as { types: string[] };
    const teleops = await handleMockGet("/api/teleops?robot_type=omx_follower") as { types: string[] };

    expect(robots.types).toContain("omx_follower");
    expect(teleops.types).toContain("omx_leader");
  });

  it("updates mock calibration guesses when OMX config is selected", async () => {
    await handleMockPost("/api/config", {
      robot_type: "omx_follower",
      teleop_type: "omx_leader",
      robot_id: "follower_arm_1",
      teleop_id: "leader_arm_1",
    });

    const calibrations = await handleMockGet("/api/calibrate/list") as {
      files: Array<{ id: string; guessed_type: string }>;
    };

    expect(calibrations.files.find((file) => file.id === "follower_arm_1")?.guessed_type).toBe("omx_follower");
    expect(calibrations.files.find((file) => file.id === "leader_arm_1")?.guessed_type).toBe("omx_leader");
  });
});

describe("mock handlers: motor monitor", () => {
  it("connects, streams frames, moves toward a target and clears collisions", async () => {
    const connect = await handleMockPost("/api/motor/connect", { port: "/dev/ttyUSB0" }) as { ok: boolean; connected_ids?: number[] };
    expect(connect.ok).toBe(true);
    expect(connect.connected_ids).toHaveLength(6);

    const first = await handleMockGet("/api/motor/positions") as { ok: boolean; connected: boolean; motors: Record<string, { position: number; collision: boolean }> };
    expect(first.connected).toBe(true);
    expect(first.motors["3"].collision).toBe(true);

    expect((await handleMockPost("/api/motor/3/move", { position: 3000 }) as { ok: boolean }).ok).toBe(false);
    expect((await handleMockPost("/api/motor/3/clear_collision") as { ok: boolean }).ok).toBe(true);
    expect((await handleMockPost("/api/motor/3/move", { position: 3000 }) as { ok: boolean }).ok).toBe(true);

    const later = await handleMockGet("/api/motor/positions") as { motors: Record<string, { position: number; collision: boolean }> };
    expect(later.motors["3"].collision).toBe(false);
    expect(later.motors["3"].position).toBeGreaterThan(first.motors["3"].position);

    await handleMockPost("/api/motor/disconnect");
    const off = await handleMockGet("/api/motor/positions") as { connected: boolean };
    expect(off.connected).toBe(false);
  });
});

describe("mock handlers: dataset jobs", () => {
  it("serves stats with a few flagged episodes and stores tags", async () => {
    const stats = await handleMockGet("/api/datasets/lerobot-user/pick_cube/stats") as { ok: boolean; episodes: Array<{ frames: number; movement: number; jerk_score: number }> };
    expect(stats.ok).toBe(true);
    expect(stats.episodes).toHaveLength(52);
    expect(stats.episodes.some((e) => e.frames < 30 || e.movement < 0.01 || e.jerk_score > 5)).toBe(true);

    await handleMockPost("/api/datasets/lerobot-user/pick_cube/tags", { episode_index: 3, tag: "bad" });
    const bulk = await handleMockPost("/api/datasets/lerobot-user/pick_cube/tags/bulk", { updates: [{ episode_index: 4, tag: "good" }, { episode_index: 5, tag: "review" }] }) as { applied: number };
    expect(bulk.applied).toBe(2);
    const tags = await handleMockGet("/api/datasets/lerobot-user/pick_cube/tags") as { tags: Record<string, string> };
    expect(tags.tags).toEqual({ "3": "bad", "4": "good", "5": "review" });
  });

  it("derives a new dataset once the job completes and can delete it", async () => {
    const start = await handleMockPost("/api/datasets/lerobot-user/place_cup/derive", { new_repo_id: "lerobot-user/place_cup_curated", keep_indices: [0, 1, 2] }) as { ok: boolean; job_id: string };
    expect(start.ok).toBe(true);
    const status = await handleMockGet(`/api/datasets/derive/status/${start.job_id}`) as { ok: boolean; status: string };
    expect(status.ok).toBe(true);
    expect(["queued", "running", "success"]).toContain(status.status);

    const del = await handleMockDelete("/api/datasets/lerobot-user/stack_blocks") as { ok: boolean };
    expect(del.ok).toBe(true);
    const list = await handleMockGet("/api/datasets") as { datasets: Array<{ id: string }> };
    expect(list.datasets.some((d) => d.id === "lerobot-user/stack_blocks")).toBe(false);
  });
});

describe("mock handlers: process status channel", () => {
  it("notifies subscribers when teleop starts and stops", async () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeMockProcessStatus((p) => seen.push(p.teleop));
    await handleMockPost("/api/teleop/start", {});
    await handleMockPost("/api/process/teleop/stop", {});
    unsubscribe();
    expect(seen).toEqual([true, false]);
  });
});
