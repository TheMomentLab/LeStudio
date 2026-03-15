import { Play } from "lucide-react";

import { ProcessButtons, StatusBadge, StickyControlBar } from "../../../components/wireframe";
import { cn } from "../../../components/ui/utils";
import type { EvalProgressStatus } from "../../../hooks/useEvalProgress";

type EvaluationControlBarProps = {
  showStarting: boolean;
  isRunning: boolean;
  progressStatus: EvalProgressStatus;
  preflightOk: boolean;
  doneEpisodes: number;
  progressTotal: number | null;
  numEpisodes: number;
  avgReward: number | null;
  computedSuccessRate: number | null;
  preflightReason: string;
  showBlockers: boolean;
  configBlockers: string[];
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function EvaluationControlBar({
  showStarting,
  isRunning,
  progressStatus,
  preflightOk,
  doneEpisodes,
  progressTotal,
  numEpisodes,
  avgReward,
  computedSuccessRate,
  preflightReason,
  showBlockers,
  configBlockers,
  disabled,
  onStart,
  onStop,
}: EvaluationControlBarProps) {
  return (
    <StickyControlBar>
      <div className="flex items-center gap-3 min-w-0">
        <StatusBadge
          status={
            showStarting ? "loading" :
            isRunning ? "running" :
            progressStatus === "completed" ? "ready" :
            progressStatus === "error" ? "blocked" :
            !preflightOk ? "blocked" : "ready"
          }
          label={
            showStarting ? "STARTING" :
            isRunning ? "EVALUATING" :
            progressStatus === "completed" ? "DONE" :
            progressStatus === "error" ? "ERROR" :
            !preflightOk ? "BLOCKED" : "READY"
          }
          pulse={isRunning}
        />
        <span className="text-sm text-zinc-400 truncate">
          {showStarting ? (
            "Starting evaluation..."
          ) : isRunning ? (
            <span className="font-mono">Episode {doneEpisodes} / {progressTotal ?? numEpisodes}</span>
          ) : (progressStatus === "completed" || progressStatus === "stopped") && avgReward !== null ? (
            <>
              Avg Reward: <span className={cn("font-mono", (avgReward ?? 0) >= 0.6 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{avgReward.toFixed(3)}</span>
              {" "}· Success: <span className={cn("font-mono", (computedSuccessRate ?? 0) >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{computedSuccessRate ?? "-"}%</span>
            </>
          ) : progressStatus === "error" ? (
            <span className="text-red-500 dark:text-red-400">Evaluation failed - check logs</span>
          ) : !preflightOk ? (
            <span className="text-amber-600 dark:text-amber-400">{preflightReason || "Device preflight failed"}</span>
          ) : showBlockers && configBlockers.length > 0 ? (
            <span className="text-amber-600 dark:text-amber-400">{configBlockers[0]}</span>
          ) : (
            "Evaluation ready"
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ProcessButtons
          running={isRunning}
          onStart={onStart}
          onStop={onStop}
          disabled={disabled}
          startLabel={<><Play size={13} className="fill-current" /> Start Eval</>}
          compact
          buttonClassName="py-1"
        />
      </div>
    </StickyControlBar>
  );
}
