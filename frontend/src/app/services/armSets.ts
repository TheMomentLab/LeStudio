/**
 * Arm selection utilities for Teleop/Record device configuration.
 *
 * Parses mapped arm symlinks into selectable follower/leader lists,
 * letting users independently choose which follower pairs with which leader.
 * Type, port, and calibration ID are auto-derived from the selection.
 */

import type { CalibrationListFile } from "./calibrationProfiles";
import { isBiCalibrationFile } from "./calibrationProfiles";

// ── Types ──────────────────────────────────────────────────────────────────

export interface DetectedArm {
  device: string;
  path: string;
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

export interface MappedArmLists {
  followers: MappedArm[];
  leaders: MappedArm[];
}

// ── Parsing ────────────────────────────────────────────────────────────────

const ARM_SYMLINK_RE = /^(follower|leader)_arm_(\d+)$/i;

function parseArmSymlink(symlink: string): { role: "follower" | "leader"; number: number } | null {
  const m = ARM_SYMLINK_RE.exec(symlink);
  if (!m) return null;
  return { role: m[1].toLowerCase() as "follower" | "leader", number: parseInt(m[2], 10) };
}

// ── Type inference from calibration files ───────────────────────────────────

const TYPE_FROM_GUESSED: Record<string, { robotType: string; teleopType: string }> = {
  so101_follower: { robotType: "so101_follower", teleopType: "so101_leader" },
  so101_leader: { robotType: "so101_follower", teleopType: "so101_leader" },
  so100_follower: { robotType: "so100_follower", teleopType: "so100_leader" },
  so100_leader: { robotType: "so100_follower", teleopType: "so100_leader" },
  bi_so_follower: { robotType: "bi_so_follower", teleopType: "bi_so_leader" },
  bi_so_leader: { robotType: "bi_so_follower", teleopType: "bi_so_leader" },
};

function inferTypesFromCalibration(
  calibrationId: string,
  calibFiles: CalibrationListFile[],
  bimanual: boolean,
): { robotType: string; teleopType: string } {
  const defaults = bimanual
    ? { robotType: "bi_so_follower", teleopType: "bi_so_leader" }
    : { robotType: "so101_follower", teleopType: "so101_leader" };

  const file = calibFiles.find((f) => f.id === calibrationId);
  if (!file?.guessed_type) return defaults;
  return TYPE_FROM_GUESSED[file.guessed_type] ?? defaults;
}

// ── Build mapped arm lists ─────────────────────────────────────────────────

export function buildMappedArmLists(
  arms: DetectedArm[],
  calibFiles: CalibrationListFile[],
): MappedArmLists {
  const followers: MappedArm[] = [];
  const leaders: MappedArm[] = [];

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
      port: `/dev/${arm.symlink}`,
      calibrationId: calibId,
      calibrationType: calibFile?.guessed_type ?? (parsed.role === "follower" ? "so101_follower" : "so101_leader"),
      calibrationExists: !!calibFile,
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
): ResolvedArmConfig {
  const findArm = (symlink: string): MappedArm | undefined =>
    [...lists.followers, ...lists.leaders].find((a) => a.symlink === symlink);

  if (mode === "Single Arm") {
    const f = findArm(selection.follower);
    const l = findArm(selection.leader);
    const types = inferTypesFromCalibration(f?.calibrationId ?? "", calibFiles, false);

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

  const biTypes = inferTypesFromCalibration(lf?.calibrationId ?? "", calibFiles, true);
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
