import { Play } from "lucide-react";

import { ProcessButtons, StatusBadge, StickyControlBar } from "../../../components/wireframe";
import type { CudaState, TrainStatus } from "../types";

type TrainingControlBarProps = {
  trainStatus: TrainStatus;
  running: boolean;
  completed: boolean;
  currentStep: number;
  latestLoss?: number;
  eta: string;
  cudaState: CudaState;
  preflightReason: string;
  onStart: () => void;
  onStop: () => void;
};

export function TrainingControlBar({
  trainStatus,
  running,
  completed,
  currentStep,
  latestLoss,
  eta,
  cudaState,
  preflightReason,
  onStart,
  onStop,
}: TrainingControlBarProps) {
  return (
    <StickyControlBar>
      <div className="flex items-center gap-3 min-w-0">
        <StatusBadge
          status={
            trainStatus === "running" ? "running" :
            trainStatus === "starting" ? "loading" :
            trainStatus === "blocked" ? "blocked" :
            "ready"
          }
          label={
            trainStatus === "running" ? "TRAINING" :
            trainStatus === "starting" ? "STARTING" :
            trainStatus === "blocked" ? "BLOCKED" :
            completed ? "DONE" :
            "READY"
          }
          pulse={trainStatus === "running"}
        />
        <span className="text-sm text-zinc-400 truncate min-w-0">
          {trainStatus === "running" ? (
            <span className="font-mono">Step {currentStep.toLocaleString()} · Loss {latestLoss?.toFixed(5) ?? "—"} · ETA {eta}</span>
          ) : trainStatus === "starting" ? (
            "Starting training..."
          ) : completed ? (
            <span className="text-emerald-600 dark:text-emerald-400">Training complete</span>
          ) : trainStatus === "blocked" || cudaState === "fail" ? (
            preflightReason || "Preflight failed"
          ) : (
            "Training ready"
          )}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ProcessButtons
          running={running}
          onStart={onStart}
          onStop={onStop}
          disabled={cudaState === "fail"}
          startLabel={<><Play size={13} className="fill-current" /> Start Training</>}
          compact
          fullWidth={false}
          buttonClassName="py-1"
        />
      </div>
    </StickyControlBar>
  );
}
