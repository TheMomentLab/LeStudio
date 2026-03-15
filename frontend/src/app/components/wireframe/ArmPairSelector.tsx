/**
 * ArmPairSelector — shared follower/leader picker for Teleop/Record.
 *
 * Users independently select which follower and which leader to use.
 * Type, port, and calibration ID are auto-derived from the selection.
 * No forced number-based pairing.
 */

import { useEffect, useMemo } from "react";
import { CheckCircle2, Unplug, XCircle } from "lucide-react";
import { EmptyState, FieldRow, WireSelect } from "./index";
import type { ArmSelection, MappedArmLists, PreferredArmTypes, ResolvedArmConfig } from "../../services/armSets";
import { buildArmOptions, resolveArmConfig } from "../../services/armSets";
import type { CalibrationListFile } from "../../services/calibrationProfiles";
import { getCalibrationHelperText, getCalibrationUiMode } from "../../services/robotPolicy";
import { useLeStudioStore } from "../../store";

// ── Props ──────────────────────────────────────────────────────────────────

interface ArmPairSelectorProps {
  mode: "Single Arm" | "Bi-Arm";
  armLists: MappedArmLists;
  calibFiles: CalibrationListFile[];
  selection: ArmSelection;
  preferredTypes?: PreferredArmTypes;
  onSelectionChange: (selection: ArmSelection) => void;
  onConfigResolved: (config: ResolvedArmConfig) => void;
  disabled?: boolean;
}

// ── Status icon ────────────────────────────────────────────────────────────

function CalibStatus({ exists, optional }: { exists: boolean; optional: boolean }) {
  if (!exists && optional) {
    return <span className="ml-1 text-[11px] text-amber-600 dark:text-amber-400">optional</span>;
  }
  return exists
    ? <CheckCircle2 size={14} className="text-emerald-500 inline-block ml-1" />
    : <XCircle size={14} className="text-red-400 inline-block ml-1" />;
}

function ArmDetail({
  label,
  symlink,
  calibrated,
  optional,
}: {
  label: string;
  symlink: string;
  calibrated: boolean;
  optional: boolean;
}) {
  return (
    <div>
      <span className="text-zinc-400">{label}:</span>{" "}
      <span className="font-mono text-zinc-600 dark:text-zinc-300">/dev/{symlink}</span>
      <CalibStatus exists={calibrated} optional={optional} />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function ArmPairSelector({
  mode,
  armLists,
  calibFiles,
  selection,
  preferredTypes,
  onSelectionChange,
  onConfigResolved,
  disabled,
}: ArmPairSelectorProps) {
  const followerOptions = useMemo(() => buildArmOptions(armLists.followers), [armLists.followers]);
  const leaderOptions = useMemo(() => buildArmOptions(armLists.leaders), [armLists.leaders]);
  const hasArms = armLists.followers.length > 0 || armLists.leaders.length > 0;
  const typeCatalog = useLeStudioStore((s) => s.typeCatalog);

  // Resolve config whenever selection changes
  const resolved = useMemo(() => {
    if (!hasArms) return null;
    return resolveArmConfig(mode, selection, armLists, calibFiles, preferredTypes);
  }, [mode, selection, armLists, calibFiles, preferredTypes, hasArms]);

  useEffect(() => {
    if (resolved) onConfigResolved(resolved);
  }, [onConfigResolved, resolved]);

  // Lookup helpers for details
  const findArm = (symlink: string) =>
    [...armLists.followers, ...armLists.leaders].find((a) => a.symlink === symlink);

  const omxNote = useMemo(() => {
    if (!resolved) return null;
    return getCalibrationHelperText(resolved.robotType, typeCatalog) || getCalibrationHelperText(resolved.teleopType, typeCatalog) || null;
  }, [resolved, typeCatalog]);

  if (!hasArms) {
    return (
      <EmptyState
        icon={<Unplug size={28} />}
        message="No mapped arms. Map your arms in Motor Setup to get started."
      />
    );
  }

  // ── Single Arm ───────────────────────────────────────────────────────────
  if (mode === "Single Arm") {
    const f = findArm(selection.follower);
    const l = findArm(selection.leader);

    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          <FieldRow label="Follower Arm">
            <WireSelect
              placeholder={followerOptions.length === 0 ? "No followers mapped" : "Select follower"}
              value={selection.follower}
              options={followerOptions}
              onChange={(v) => onSelectionChange({ ...selection, follower: v })}
              disabled={disabled}
            />
          </FieldRow>
          <FieldRow label="Leader Arm">
            <WireSelect
              placeholder={leaderOptions.length === 0 ? "No leaders mapped" : "Select leader"}
              value={selection.leader}
              options={leaderOptions}
              onChange={(v) => onSelectionChange({ ...selection, leader: v })}
              disabled={disabled}
            />
          </FieldRow>
        </div>

        {/* Details */}
        {(f || l) && (
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {f && <ArmDetail label="Follower" symlink={f.symlink} calibrated={f.calibrationExists} optional={getCalibrationUiMode(f.calibrationType, typeCatalog) === "optional"} />}
              {l && <ArmDetail label="Leader" symlink={l.symlink} calibrated={l.calibrationExists} optional={getCalibrationUiMode(l.calibrationType, typeCatalog) === "optional"} />}
            </div>
            {omxNote && <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">{omxNote}</div>}
          </div>
        )}
      </div>
    );
  }

  // ── Bi-Arm ───────────────────────────────────────────────────────────────
  const lf = findArm(selection.leftFollower ?? selection.follower);
  const rf = findArm(selection.rightFollower ?? selection.follower);
  const ll = findArm(selection.leftLeader ?? selection.leader);
  const rl = findArm(selection.rightLeader ?? selection.leader);

  const updateBi = (patch: Partial<ArmSelection>) => onSelectionChange({ ...selection, ...patch });

  return (
    <div className="flex flex-col gap-3">
      {/* Left pair */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <FieldRow label="Left Follower">
          <WireSelect
            placeholder={followerOptions.length === 0 ? "No followers" : "Select"}
            value={selection.leftFollower ?? selection.follower}
            options={followerOptions}
            onChange={(v) => updateBi({ leftFollower: v })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label="Left Leader">
          <WireSelect
            placeholder={leaderOptions.length === 0 ? "No leaders" : "Select"}
            value={selection.leftLeader ?? selection.leader}
            options={leaderOptions}
            onChange={(v) => updateBi({ leftLeader: v })}
            disabled={disabled}
          />
        </FieldRow>
      </div>

      {/* Right pair */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <FieldRow label="Right Follower">
          <WireSelect
            placeholder={followerOptions.length === 0 ? "No followers" : "Select"}
            value={selection.rightFollower ?? selection.follower}
            options={followerOptions}
            onChange={(v) => updateBi({ rightFollower: v })}
            disabled={disabled}
          />
        </FieldRow>
        <FieldRow label="Right Leader">
          <WireSelect
            placeholder={leaderOptions.length === 0 ? "No leaders" : "Select"}
            value={selection.rightLeader ?? selection.leader}
            options={leaderOptions}
            onChange={(v) => updateBi({ rightLeader: v })}
            disabled={disabled}
          />
        </FieldRow>
      </div>

      {/* Details */}
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-col gap-0.5">
            <span className="text-zinc-400 font-medium">Left</span>
            {lf && <ArmDetail label="Follower" symlink={lf.symlink} calibrated={lf.calibrationExists} optional={getCalibrationUiMode(lf.calibrationType, typeCatalog) === "optional"} />}
            {ll && <ArmDetail label="Leader" symlink={ll.symlink} calibrated={ll.calibrationExists} optional={getCalibrationUiMode(ll.calibrationType, typeCatalog) === "optional"} />}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-zinc-400 font-medium">Right</span>
            {rf && <ArmDetail label="Follower" symlink={rf.symlink} calibrated={rf.calibrationExists} optional={getCalibrationUiMode(rf.calibrationType, typeCatalog) === "optional"} />}
            {rl && <ArmDetail label="Leader" symlink={rl.symlink} calibrated={rl.calibrationExists} optional={getCalibrationUiMode(rl.calibrationType, typeCatalog) === "optional"} />}
          </div>
        </div>
        {omxNote && <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">{omxNote}</div>}
      </div>
    </div>
  );
}
