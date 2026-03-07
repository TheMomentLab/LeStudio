/**
 * Shared utilities for converting device symlink names to human-readable labels
 * and building port option lists with display names.
 */

/** Convert symlink like "follower_arm_1" → "Follower Arm 1" */
export function symToDisplayLabel(sym: string): string {
  return sym.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type ArmLike = { device?: string; path?: string; symlink?: string | null };

export type PortOption = { value: string; label: string };

/** Build port options with human-readable symlink labels for WireSelect dropdowns */
export function buildPortOptions(arms: ArmLike[]): PortOption[] {
  return arms.map((a) => {
    const path = a.path ?? `/dev/${a.device}`;
    const label = a.symlink ? `${symToDisplayLabel(a.symlink)}  (${path})` : path;
    return { value: path, label };
  });
}

/**
 * Build port options from raw symlink-based paths like "/dev/leader_arm_1".
 * Used by pages that only have string paths (Teleop, Recording).
 */
export function buildPortOptionsFromPaths(ports: string[]): PortOption[] {
  return ports.map((p) => {
    const match = p.match(/^\/dev\/([a-zA-Z][\w]*)$/);
    if (match && match[1] && !/^tty/.test(match[1])) {
      // It's a symlink path like /dev/leader_arm_1
      return { value: p, label: `${symToDisplayLabel(match[1])}  (${p})` };
    }
    return { value: p, label: p };
  });
}
