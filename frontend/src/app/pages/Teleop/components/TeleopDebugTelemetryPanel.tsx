import {
  formatDebugNumber,
  formatJointName,
  type TeleopDebugJointRow,
  type TeleopDebugMeta,
  type TeleopDebugSnapshot,
} from "../shared";

type TeleopDebugTelemetryPanelProps = {
  debugEnabled: boolean;
  debugMeta: TeleopDebugMeta | null;
  debugSnapshot: TeleopDebugSnapshot | null;
  debugJointRows: TeleopDebugJointRow[];
  debugAgeMs: number | null;
  wsReady: boolean;
  loopMetrics: { loopMs: number; hz: number } | null;
  selectedFollowerPort: string;
  selectedLeaderPort: string;
  selectedFollowerId: string;
  selectedLeaderId: string;
  selectedCamerasCount: number;
  camerasMappedCount: number;
  invertShoulderLift: boolean;
  invertWristRoll: boolean;
  antiJitterEnabled: boolean;
  antiJitterAlpha: number;
  antiJitterDeadband: number;
  teleopLogsCount: number;
  running: boolean;
};

export function TeleopDebugTelemetryPanel({
  debugEnabled,
  debugMeta,
  debugSnapshot,
  debugJointRows,
  debugAgeMs,
  wsReady,
  loopMetrics,
  selectedFollowerPort,
  selectedLeaderPort,
  selectedFollowerId,
  selectedLeaderId,
  selectedCamerasCount,
  camerasMappedCount,
  invertShoulderLift,
  invertWristRoll,
  antiJitterEnabled,
  antiJitterAlpha,
  antiJitterDeadband,
  teleopLogsCount,
  running,
}: TeleopDebugTelemetryPanelProps) {
  if (!debugEnabled) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Teleop Debug Telemetry</span>
        <span className="text-xs font-mono text-zinc-400">
          {debugMeta?.debug_interval_s ? `sample ${debugMeta.debug_interval_s}s` : "waiting for process telemetry"}
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Runtime</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
              <span>WS: {wsReady ? "connected" : "disconnected"}</span>
              <span>Loop Hz: {loopMetrics ? formatDebugNumber(loopMetrics.hz) : "-"}</span>
              <span>Loop ms: {debugSnapshot ? formatDebugNumber(debugSnapshot.active_loop_ms) : loopMetrics ? formatDebugNumber(loopMetrics.loopMs) : "-"}</span>
              <span>Loop #: {debugSnapshot?.loop_index ?? "-"}</span>
              <span>Uptime: {debugSnapshot ? formatDebugNumber(debugSnapshot.uptime_s) : "-"}s</span>
              <span>Sample age: {debugAgeMs !== null ? `${debugAgeMs}ms` : "-"}</span>
            </div>
          </div>

          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Device Mapping</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1 font-mono">
              <span>Follower: {selectedFollowerPort || "-"}</span>
              <span>Leader: {selectedLeaderPort || "-"}</span>
              <span>Robot ID: {selectedFollowerId || "-"}</span>
              <span>Teleop ID: {selectedLeaderId || "-"}</span>
              <span>Cams: {selectedCamerasCount}/{camerasMappedCount}</span>
            </div>
          </div>

          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Mapping Controls</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
              <span>Invert shoulder: {invertShoulderLift ? "on" : "off"}</span>
              <span>Invert wrist: {invertWristRoll ? "on" : "off"}</span>
              <span>Anti-jitter: {(debugMeta?.antijitter_enabled ?? antiJitterEnabled) ? "on" : "off"}</span>
              <span>Alpha: {formatDebugNumber(debugMeta?.antijitter_alpha ?? antiJitterAlpha)}</span>
              <span>Deadband: {formatDebugNumber(debugMeta?.antijitter_deadband ?? antiJitterDeadband)}</span>
            </div>
          </div>

          <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
            <div className="text-xs uppercase tracking-wide text-zinc-400">Signals</div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
              <span>Log lines: {teleopLogsCount}</span>
              <span>Supported: {debugMeta?.debug_supported === false ? "no" : "yes"}</span>
              <span>Leader joints: {debugSnapshot ? Object.keys(debugSnapshot.leader_raw_pos).length : 0}</span>
              <span>Current joints: {debugSnapshot ? Object.keys(debugSnapshot.follower_current_pos).length : 0}</span>
              <span>Goal joints: {debugSnapshot ? Object.keys(debugSnapshot.follower_goal_pos).length : 0}</span>
              <span>Invert joints: {debugMeta?.invert_joints?.join(", ") || "none"}</span>
            </div>
          </div>
        </div>

        {debugSnapshot ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Joint Coverage</div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
                  <span>Total joints: {debugSnapshot.joint_count_total}</span>
                  <span>Shown joints: {debugSnapshot.joint_count_emitted}</span>
                  <span>Truncated: {debugSnapshot.truncated ? "yes" : "no"}</span>
                  <span>Schema: v{debugSnapshot.schema_version}</span>
                </div>
              </div>

              <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 p-3">
                <div className="text-xs uppercase tracking-wide text-zinc-400">Goal Error</div>
                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 flex flex-col gap-1">
                  <span>Max abs: {formatDebugNumber(debugSnapshot.max_abs_goal_error)}</span>
                  <span>RMS: {formatDebugNumber(debugSnapshot.rms_goal_error)}</span>
                  <span>Worst joint: {debugSnapshot.worst_joint ? formatJointName(debugSnapshot.worst_joint) : "-"}</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-sm font-mono">
                <thead className="bg-zinc-50 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Joint</th>
                    <th className="px-3 py-2 text-right">Leader Raw</th>
                    <th className="px-3 py-2 text-right">Current</th>
                    <th className="px-3 py-2 text-right">Mapped</th>
                    <th className="px-3 py-2 text-right">Goal</th>
                    <th className="px-3 py-2 text-right">Goal-Current</th>
                  </tr>
                </thead>
                <tbody>
                  {debugJointRows.map((row) => (
                    <tr key={row.key} className="border-t border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                      <td className="px-3 py-2 whitespace-nowrap">{formatJointName(row.key)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.leader)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.current)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.mapped)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.goal)}</td>
                      <td className="px-3 py-2 text-right">{formatDebugNumber(row.error)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-200 p-3 overflow-x-auto">
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Latest Raw Snapshot</div>
              <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(debugSnapshot, null, 2)}</pre>
            </div>
          </>
        ) : (
          <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            {debugMeta?.debug_supported === false
              ? `Debug overlay is enabled, but this teleop runtime reported that structured snapshots are unsupported (${debugMeta.reason ?? "unknown reason"}).`
              : running
                ? "Debug overlay is enabled, but Teleop has not emitted a snapshot yet. Start Teleop and move the leader slightly to populate runtime data."
                : "Debug overlay is enabled. Start Teleop to stream live leader/current/goal telemetry here."}
          </div>
        )}
      </div>
    </div>
  );
}
