import { describe, expect, it } from "vitest";

import type { TypePolicyCatalogResponse } from "../../store/types";
import { deriveSetupArmTypes } from "./constants";

const CATALOG: TypePolicyCatalogResponse = {
  version: 1,
  defaults: {
    single: { robot_type: "so101_follower", teleop_type: "so101_leader" },
    bi: { robot_type: "bi_so_follower", teleop_type: "bi_so_leader" },
  },
  types: {
    so101_follower: {
      type_name: "so101_follower",
      registry_kind: "robot",
      family_id: "so",
      role: "follower",
      pairing: { canonical_robot_type: "so101_follower", canonical_teleop_type: "so101_leader" },
      calibration: {
        requirement: "required",
        enforcement: { preflight: "warn", eval_real_robot: "block", ui: "required" },
        validator_id: "feetech_sts3215",
      },
      motor_setup: { supported: true },
      bimanual: { supported: false, group_type: "" },
    },
    so101_leader: {
      type_name: "so101_leader",
      registry_kind: "teleop",
      family_id: "so",
      role: "leader",
      pairing: { canonical_robot_type: "so101_follower", canonical_teleop_type: "so101_leader" },
      calibration: {
        requirement: "required",
        enforcement: { preflight: "warn", eval_real_robot: "block", ui: "required" },
        validator_id: "feetech_sts3215",
      },
      motor_setup: { supported: true },
      bimanual: { supported: false, group_type: "" },
    },
    omx_follower: {
      type_name: "omx_follower",
      registry_kind: "robot",
      family_id: "omx",
      role: "follower",
      pairing: { canonical_robot_type: "omx_follower", canonical_teleop_type: "omx_leader" },
      calibration: {
        requirement: "optional",
        enforcement: { preflight: "skip", eval_real_robot: "skip", ui: "optional" },
        validator_id: "none",
      },
      motor_setup: { supported: true },
      bimanual: { supported: false, group_type: "" },
    },
    omx_leader: {
      type_name: "omx_leader",
      registry_kind: "teleop",
      family_id: "omx",
      role: "leader",
      pairing: { canonical_robot_type: "omx_follower", canonical_teleop_type: "omx_leader" },
      calibration: {
        requirement: "optional",
        enforcement: { preflight: "skip", eval_real_robot: "skip", ui: "optional" },
        validator_id: "none",
      },
      motor_setup: { supported: true },
      bimanual: { supported: false, group_type: "" },
    },
  },
  lerobot_available: true,
};

describe("deriveSetupArmTypes", () => {
  it("keeps supported leader types from defaults even when /api/robots only returns followers", () => {
    const result = deriveSetupArmTypes(["so101_follower", "omx_follower"], CATALOG);

    expect(result).toContain("omx_follower");
    expect(result).toContain("omx_leader");
    expect(result).toContain("so101_leader");
  });
});
