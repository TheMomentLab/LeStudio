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

/**
 * Role-based sort priority: leader first, follower second, unmapped last.
 * Within the same role, sort by trailing number (arm 1 before arm 2).
 */
function portSortKey(symlink: string | null | undefined): [number, number] {
  if (!symlink) return [2, 0];
  const lower = symlink.toLowerCase();
  const role = lower.includes("leader") ? 0 : lower.includes("follower") ? 1 : 2;
  const numMatch = lower.match(/(\d+)$/);
  const num = numMatch ? Number(numMatch[1]) : 0;
  return [role, num];
}

/** Build port options with human-readable symlink labels, sorted by role (leader → follower → unmapped) */
export function buildPortOptions(arms: ArmLike[]): PortOption[] {
  return arms
    .map((a) => {
      const path = a.path ?? `/dev/${a.device}`;
      const label = a.symlink ? `${symToDisplayLabel(a.symlink)}  (${path})` : path;
      return { value: path, label, _sym: a.symlink };
    })
    .sort((a, b) => {
      const [aRole, aNum] = portSortKey(a._sym);
      const [bRole, bNum] = portSortKey(b._sym);
      return aRole !== bRole ? aRole - bRole : aNum - bNum;
    })
    .map(({ value, label }) => ({ value, label }));
}
