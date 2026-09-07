import { describe, expect, it } from "vitest";

import type { ResolvedArmConfig } from "../../services/armSets";
import { getResolvedConfigSignature, shouldPublishResolvedConfig } from "./armPairSelectorState";

const BASE_CONFIG: ResolvedArmConfig = {
  robotType: "omx_follower",
  teleopType: "omx_leader",
  followerPort: "/dev/follower_arm_1",
  leaderPort: "/dev/leader_arm_1",
  followerId: "follower_arm_1",
  leaderId: "leader_arm_1",
  leftFollowerPort: "",
  rightFollowerPort: "",
  leftLeaderPort: "",
  rightLeaderPort: "",
  leftRobotId: "",
  rightRobotId: "",
  leftTeleopId: "",
  rightTeleopId: "",
};

describe("armPairSelectorState", () => {
  it("treats semantically identical resolved configs as the same publication", () => {
    const first = getResolvedConfigSignature(BASE_CONFIG);
    const second = getResolvedConfigSignature({ ...BASE_CONFIG });

    expect(first).toBe(second);
    expect(shouldPublishResolvedConfig(null, BASE_CONFIG)).toBe(true);
    expect(shouldPublishResolvedConfig(first, { ...BASE_CONFIG })).toBe(false);
  });

  it("publishes again when any meaningful resolved value changes", () => {
    const initial = getResolvedConfigSignature(BASE_CONFIG);
    const changed = { ...BASE_CONFIG, leaderPort: "/dev/leader_arm_2" };

    expect(shouldPublishResolvedConfig(initial, changed)).toBe(true);
  });
});
