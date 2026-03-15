import { beforeEach, describe, expect, it } from "vitest";

import { handleMockGet, handleMockPost } from "./handlers";

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
