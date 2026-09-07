/**
 * Arm selection utilities for Teleop/Record device configuration.
 *
 * Parses mapped arm symlinks into selectable follower/leader lists,
 * letting users independently choose which follower pairs with which leader.
 * Type, port, and calibration ID are auto-derived from the selection.
 */

import type { CalibrationListFile } from "./calibrationProfiles";
import { isBiCalibrationFile } from "./calibrationProfiles";
import { getCalibrationUiMode, getDefaults } from "./robotPolicy";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DetectedArm {
  device: string;
  path?: string;
  symlink?: string | null;
  serial?: string;
}

export interface MappedArm {
  role: "follower" | "leader";
  number: number;
  symlink: string;
  port: string;
  calibrationId: string;
  calibrationType: string;
  calibrationExists: boolean;
  typeSource: "calibration" | "symlink" | "default";
  label: string;
}

export interface ArmSelection {
  follower: string;  // symlink e.g. "follower_arm_1"
  leader: string;    // symlink e.g. "leader_arm_1"
  // bi-arm only
  leftFollower?: string;
  rightFollower?: string;
  leftLeader?: string;
  rightLeader?: string;
}

export interface ResolvedArmConfig {
  robotType: string;
  teleopType: string;
  followerPort: string;
  leaderPort: string;
  followerId: string;
  leaderId: string;
  leftFollowerPort: string;
  rightFollowerPort: string;
  leftLeaderPort: string;
  rightLeaderPort: string;
  leftRobotId: string;
  rightRobotId: string;
  leftTeleopId: string;
  rightTeleopId: string;
}

export interface PreferredArmTypes {
  robotType?: string;
  teleopType?: string;
}

export interface MappedArmLists {
  followers: MappedArm[];
  leaders: MappedArm[];
}

// ── Parsing ────────────────────────────────────────────────────────────────

const NUMBERED_ARM_SYMLINK_RE = /^(follower|leader)_arm_(\d+)$/i;
const OMX_ARM_SYMLINK_RE = /^omx_(follower|leader)$/i;

function parseArmSymlink(
  symlink: string,
): { role: "follower" | "leader"; number: number; inferredType?: string } | null {
  const numbered = NUMBERED_ARM_SYMLINK_RE.exec(symlink);
  if (numbered) {
    return { role: numbered[1].toLowerCase() as "follower" | "leader", number: parseInt(numbered[2], 10) };
  }

  const omx = OMX_ARM_SYMLINK_RE.exec(symlink);
  if (omx) {
    const role = omx[1].toLowerCase() as "follower" | "leader";
    return { role, number: 1, inferredType: `omx_${role}` };
  }

  return null;
}

// ── Type inference from calibration files ───────────────────────────────────

const TYPE_FROM_GUESSED: Record<string, { robotType: string; teleopType: string }> = {
  so101_follower: { robotType: "so101_follower", teleopType: "so101_leader" },
  so101_leader: { robotType: "so101_follower", teleopType: "so101_leader" },
  so100_follower: { robotType: "so100_follower", teleopType: "so100_leader" },
  so100_leader: { robotType: "so100_follower", teleopType: "so100_leader" },
  omx_follower: { robotType: "omx_follower", teleopType: "omx_leader" },
  omx_leader: { robotType: "omx_follower", teleopType: "omx_leader" },
  bi_so_follower: { robotType: "bi_so_follower", teleopType: "bi_so_leader" },
  bi_so_leader: { robotType: "bi_so_follower", teleopType: "bi_so_leader" },
};

function normalizePreferredTypes(
  preferredTypes: PreferredArmTypes | undefined,
  bimanual: boolean,
): { robotType: string; teleopType: string } | null {
  const robotType = preferredTypes?.robotType?.trim() ?? "";
  const teleopType = preferredTypes?.teleopType?.trim() ?? "";
  if (!robotType || !teleopType) return null;
  if (bimanual) {
    return robotType.startsWith("bi_") && teleopType.startsWith("bi_")
      ? { robotType, teleopType }
      : null;
  }
  return robotType.startsWith("bi_") || teleopType.startsWith("bi_")
    ? null
    : { robotType, teleopType };
}

function inferTypesFromArm(arm: MappedArm | undefined): { robotType: string; teleopType: string } | null {
  if (!arm || arm.typeSource === "default") return null;
  return TYPE_FROM_GUESSED[arm.calibrationType] ?? null;
}

export function isCalibrationOptionalType(typeName: string): boolean {
  return getCalibrationUiMode((typeName || "").trim()) === "optional";
}

// ── Build mapped arm lists ─────────────────────────────────────────────────

export function buildMappedArmLists(
  arms: DetectedArm[],
  calibFiles: CalibrationListFile[],
): MappedArmLists {
  const followers: MappedArm[] = [];
  const leaders: MappedArm[] = [];
  const singleDefaults = getDefaults("single");

  for (const arm of arms) {
    if (!arm.symlink) continue;
    const parsed = parseArmSymlink(arm.symlink);
    if (!parsed) continue;

    const calibId = arm.symlink;
    const calibFile = calibFiles.find(
      (f) => f.id === calibId && !isBiCalibrationFile(f),
    );

      const mapped: MappedArm = {
        role: parsed.role,
        number: parsed.number,
        symlink: arm.symlink,
        port: arm.symlink ? `/dev/${arm.symlink}` : (arm.path ?? ""),
        calibrationId: calibId,
        calibrationType: calibFile?.guessed_type ?? parsed.inferredType ?? (parsed.role === "follower" ? singleDefaults.robot_type : singleDefaults.teleop_type),
        calibrationExists: !!calibFile,
        typeSource: calibFile?.guessed_type ? "calibration" : parsed.inferredType ? "symlink" : "default",
        label: arm.symlink,
      };

    if (parsed.role === "follower") {
      followers.push(mapped);
    } else {
      leaders.push(mapped);
    }
  }

  followers.sort((a, b) => a.number - b.number);
  leaders.sort((a, b) => a.number - b.number);

  return { followers, leaders };
}

// ── Default selection ──────────────────────────────────────────────────────

export function defaultArmSelection(
  lists: MappedArmLists,
  mode: "Single Arm" | "Bi-Arm",
): ArmSelection {
  const f1 = lists.followers[0]?.symlink ?? "";
  const f2 = lists.followers[1]?.symlink ?? f1;
  const l1 = lists.leaders[0]?.symlink ?? "";
  const l2 = lists.leaders[1]?.symlink ?? l1;

  if (mode === "Single Arm") {
    return { follower: f1, leader: l1 };
  }
  return {
    follower: f1,
    leader: l1,
    leftFollower: f1,
    rightFollower: f2,
    leftLeader: l1,
    rightLeader: l2,
  };
}

// ── Resolve config from selection ──────────────────────────────────────────

export function resolveArmConfig(
  mode: "Single Arm" | "Bi-Arm",
  selection: ArmSelection,
  lists: MappedArmLists,
  calibFiles: CalibrationListFile[],
  preferredTypes?: PreferredArmTypes,
): ResolvedArmConfig {
  void calibFiles;
  const findArm = (symlink: string): MappedArm | undefined =>
    [...lists.followers, ...lists.leaders].find((a) => a.symlink === symlink);

  if (mode === "Single Arm") {
    const f = findArm(selection.follower);
    const l = findArm(selection.leader);
    const singleDefaults = getDefaults("single");
    const types = inferTypesFromArm(f)
      ?? inferTypesFromArm(l)
      ?? normalizePreferredTypes(preferredTypes, false)
      ?? { robotType: singleDefaults.robot_type, teleopType: singleDefaults.teleop_type };

    return {
      robotType: types.robotType,
      teleopType: types.teleopType,
      followerPort: f?.port ?? "",
      leaderPort: l?.port ?? "",
      followerId: f?.calibrationId ?? "",
      leaderId: l?.calibrationId ?? "",
      leftFollowerPort: "",
      rightFollowerPort: "",
      leftLeaderPort: "",
      rightLeaderPort: "",
      leftRobotId: "",
      rightRobotId: "",
      leftTeleopId: "",
      rightTeleopId: "",
    };
  }

  // Bi-Arm
  const lf = findArm(selection.leftFollower ?? selection.follower);
  const rf = findArm(selection.rightFollower ?? selection.follower);
  const ll = findArm(selection.leftLeader ?? selection.leader);
  const rl = findArm(selection.rightLeader ?? selection.leader);
  const biDefaults = getDefaults("bi");

  const biTypes = inferTypesFromArm(lf)
    ?? inferTypesFromArm(ll)
    ?? normalizePreferredTypes(preferredTypes, true)
    ?? { robotType: biDefaults.robot_type, teleopType: biDefaults.teleop_type };
  const sharedFollowerBase = (lf?.symlink ?? "follower_arm").replace(/_\d+$/, "");
  const sharedLeaderBase = (ll?.symlink ?? "leader_arm").replace(/_\d+$/, "");

  return {
    robotType: biTypes.robotType,
    teleopType: biTypes.teleopType,
    followerPort: lf?.port ?? "",
    leaderPort: ll?.port ?? "",
    followerId: lf?.calibrationId ?? "",
    leaderId: ll?.calibrationId ?? "",
    leftFollowerPort: lf?.port ?? "",
    rightFollowerPort: rf?.port ?? "",
    leftLeaderPort: ll?.port ?? "",
    rightLeaderPort: rl?.port ?? "",
    leftRobotId: `${sharedFollowerBase}_left`,
    rightRobotId: `${sharedFollowerBase}_right`,
    leftTeleopId: `${sharedLeaderBase}_left`,
    rightTeleopId: `${sharedLeaderBase}_right`,
  };
}

// ── WireSelect option builders ─────────────────────────────────────────────

export function buildArmOptions(arms: MappedArm[]): string[] {
  return arms.map((a) => a.symlink);
}
