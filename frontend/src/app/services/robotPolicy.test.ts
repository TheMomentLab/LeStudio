import { beforeEach, describe, expect, it } from "vitest";

import { resetLeStudioState, setLeStudioState } from "../store";
import type { TypePolicyCatalogResponse } from "../store/types";
import {
  getCalibrationHelperText,
  getCalibrationUiMode,
  getCanonicalPair,
  getDefaults,
  getTypePolicy,
  isCalibrationOptional,
  supportsMotorSetup,
} from "./robotPolicy";

const CATALOG: TypePolicyCatalogResponse = {
  version: 1,
  defaults: {
    single: { robot_type: "so101_follower", teleop_type: "so101_leader" },
    bi: { robot_type: "bi_so_follower", teleop_type: "bi_so_leader" },
  },
  types: {
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
  },
  lerobot_available: true,
};

describe("robotPolicy", () => {
  beforeEach(() => {
    resetLeStudioState();
  });

  it("reads defaults and type policy from the loaded catalog", () => {
    setLeStudioState({ typeCatalog: CATALOG, typeCatalogVersion: 1, typeCatalogLoaded: true });

    expect(getDefaults("single")).toEqual(CATALOG.defaults.single);
    expect(getTypePolicy("omx_follower")).toMatchObject({ family_id: "omx", registry_kind: "robot" });
    expect(getCanonicalPair("omx_follower")).toEqual({ robotType: "omx_follower", teleopType: "omx_leader" });
    expect(getCalibrationUiMode("omx_follower")).toBe("optional");
    expect(getCalibrationHelperText("omx_follower")).toContain("optional");
    expect(isCalibrationOptional("omx_follower")).toBe(true);
    expect(supportsMotorSetup("omx_follower")).toBe(true);
  });

  it("falls back safely when the catalog is not loaded", () => {
    expect(getDefaults("single")).toEqual({ robot_type: "so101_follower", teleop_type: "so101_leader" });
    expect(getDefaults("bi")).toEqual({ robot_type: "bi_so_follower", teleop_type: "bi_so_leader" });
    expect(getTypePolicy("unknown_type")).toBeNull();
    expect(getCanonicalPair("unknown_type")).toEqual({ robotType: "unknown_type", teleopType: "" });
    expect(getCalibrationUiMode("unknown_type")).toBe("required");
    expect(getCalibrationHelperText("unknown_type")).toBe("");
    expect(isCalibrationOptional("unknown_type")).toBe(false);
    expect(supportsMotorSetup("unknown_type")).toBe(false);
  });
});
