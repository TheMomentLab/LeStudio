export type TeleopPhase = "idle" | "loading" | "running";

export type CalibFile = { id: string; guessed_type: string; rel_path?: string };

export type MappedCamera = { role: string; path: string };

export type TeleopDebugMeta = {
  antijitter_alpha?: number;
  antijitter_deadband?: number;
  antijitter_enabled?: boolean;
  antijitter_max_step?: number | null;
  debug_enabled?: boolean;
  debug_supported?: boolean;
  debug_interval_s?: number;
  invert_joints?: string[];
  reason?: string;
  schema_version?: number;
};

export type TeleopDebugSnapshot = {
  schema_version: number;
  emitted_at_ms: number;
  joint_count_total: number;
  joint_count_emitted: number;
  truncated: boolean;
  loop_index: number;
  uptime_s: number;
  active_loop_ms: number;
  leader_raw_pos: Record<string, number>;
  follower_current_pos: Record<string, number>;
  teleop_action_pos: Record<string, number>;
  follower_goal_pos: Record<string, number>;
  goal_minus_current_pos: Record<string, number>;
  max_abs_goal_error: number;
  rms_goal_error: number;
  worst_joint: string;
};

export type TeleopDebugJointRow = {
  key: string;
  leader?: number;
  current?: number;
  mapped?: number;
  goal?: number;
  error?: number;
};

export function formatJointName(key: string): string {
  return key.replace(/\.pos$/, "").replace(/_/g, " ");
}

export function formatDebugNumber(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}
