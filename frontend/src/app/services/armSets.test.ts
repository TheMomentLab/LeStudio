import { describe, expect, it } from "vitest";

import { resetLeStudioState, setLeStudioState } from "../store";
import type { TypePolicyCatalogResponse } from "../store/types";
import type { CalibrationListFile } from "./calibrationProfiles";
import { buildMappedArmLists, defaultArmSelection, resolveArmConfig } from "./armSets";

const CUSTOM_DEFAULTS: TypePolicyCatalogResponse = {
  version: 1,
  defaults: {
    single: { robot_type: "custom_single_follower", teleop_type: "custom_single_leader" },
    bi: { robot_type: "custom_bi_follower", teleop_type: "custom_bi_leader" },
  },
  types: {},
  lerobot_available: true,
};

describe("armSets OMX support", () => {
  it("recognizes OMX symlink names without calibration files", () => {
    const lists = buildMappedArmLists(
      [
        { device: "ttyACM0", path: "/dev/ttyACM0", symlink: "omx_follower" },
        { device: "ttyACM1", path: "/dev/ttyACM1", symlink: "omx_leader" },
      ],
      [],
    );

    expect(lists.followers).toHaveLength(1);
    expect(lists.leaders).toHaveLength(1);
    expect(lists.followers[0]).toMatchObject({
      symlink: "omx_follower",
      calibrationType: "omx_follower",
      typeSource: "symlink",
    });
    expect(lists.leaders[0]).toMatchObject({
      symlink: "omx_leader",
      calibrationType: "omx_leader",
      typeSource: "symlink",
    });
  });

  it("preserves OMX preferred types when generic arm symlinks are ambiguous", () => {
    const lists = buildMappedArmLists(
      [
        { device: "ttyACM0", path: "/dev/ttyACM0", symlink: "follower_arm_1" },
        { device: "ttyACM1", path: "/dev/ttyACM1", symlink: "leader_arm_1" },
      ],
      [],
    );

    const selection = defaultArmSelection(lists, "Single Arm");
    const resolved = resolveArmConfig("Single Arm", selection, lists, [], {
      robotType: "omx_follower",
      teleopType: "omx_leader",
    });

    expect(resolved.robotType).toBe("omx_follower");
    expect(resolved.teleopType).toBe("omx_leader");
  });

  it("keeps OMX types from calibration metadata", () => {
    const files: CalibrationListFile[] = [
      { id: "follower_arm_1", guessed_type: "omx_follower" },
      { id: "leader_arm_1", guessed_type: "omx_leader" },
    ];
    const lists = buildMappedArmLists(
      [
        { device: "ttyACM0", path: "/dev/ttyACM0", symlink: "follower_arm_1" },
        { device: "ttyACM1", path: "/dev/ttyACM1", symlink: "leader_arm_1" },
      ],
      files,
    );

    const selection = defaultArmSelection(lists, "Single Arm");
    const resolved = resolveArmConfig("Single Arm", selection, lists, files);

    expect(resolved.robotType).toBe("omx_follower");
    expect(resolved.teleopType).toBe("omx_leader");
  });

  it("keeps existing SO fallback when no OMX signal exists", () => {
    const lists = buildMappedArmLists(
      [
        { device: "ttyUSB0", path: "/dev/ttyUSB0", symlink: "follower_arm_1" },
        { device: "ttyUSB1", path: "/dev/ttyUSB1", symlink: "leader_arm_1" },
      ],
      [],
    );

    const selection = defaultArmSelection(lists, "Single Arm");
    const resolved = resolveArmConfig("Single Arm", selection, lists, []);

    expect(resolved.robotType).toBe("so101_follower");
    expect(resolved.teleopType).toBe("so101_leader");
  });

  it("uses policy catalog defaults when no arm type signal exists", () => {
    resetLeStudioState();
    setLeStudioState({ typeCatalog: CUSTOM_DEFAULTS, typeCatalogVersion: 1, typeCatalogLoaded: true });

    const lists = buildMappedArmLists(
      [
        { device: "ttyUSB0", path: "/dev/ttyUSB0", symlink: "follower_arm_1" },
        { device: "ttyUSB1", path: "/dev/ttyUSB1", symlink: "leader_arm_1" },
      ],
      [],
    );

    const selection = defaultArmSelection(lists, "Single Arm");
    const resolved = resolveArmConfig("Single Arm", selection, lists, []);

    expect(resolved.robotType).toBe("custom_single_follower");
    expect(resolved.teleopType).toBe("custom_single_leader");

    resetLeStudioState();
  });

  it("uses policy defaults for fallback calibration type labels", () => {
    resetLeStudioState();
    setLeStudioState({ typeCatalog: CUSTOM_DEFAULTS, typeCatalogVersion: 1, typeCatalogLoaded: true });

    const lists = buildMappedArmLists(
      [
        { device: "ttyUSB0", path: "/dev/ttyUSB0", symlink: "follower_arm_1" },
        { device: "ttyUSB1", path: "/dev/ttyUSB1", symlink: "leader_arm_1" },
      ],
      [],
    );

    expect(lists.followers[0]?.calibrationType).toBe("custom_single_follower");
    expect(lists.leaders[0]?.calibrationType).toBe("custom_single_leader");

    resetLeStudioState();
  });
});
