import { Cpu } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, EmptyState, StatusBadge } from "../../../components/wireframe";
import { cn } from "../../../components/ui/utils";
import { CustomTooltip } from "./CustomTooltip";
import { TrainOomBanner } from "./TrainOomBanner";
import { useChartTokens } from "../../../hooks/useChartTokens";

interface TrainProgressPanelProps {
  currentStep: number;
  totalSteps: number;
  latestLoss: number | undefined;
  eta: string;
  policyType: string;
  gpuSnapshot: {
    util: number;
    vramUsedGb: number;
    vramTotalGb: number;
  };
  progress: number;
  lossData: { step: number; loss: number }[];
  oomDetected: boolean;
  onRetryAfterOom: () => void;
}

export function TrainProgressPanel({
  currentStep,
  totalSteps,
  latestLoss,
  eta,
  policyType,
  gpuSnapshot,
  progress,
  lossData,
  oomDetected,
  onRetryAfterOom,
}: TrainProgressPanelProps) {
  const chart = useChartTokens();
  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Training Progress"
        action={<StatusBadge status="running" label="RUNNING" pulse />}
        bodyClassName="flex flex-col gap-4"
      >
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-fg-muted">Step</span>
            <span className="text-sm font-mono text-fg-body">
              {currentStep.toLocaleString()} <span className="text-fg-muted text-sm">/ {totalSteps.toLocaleString()}</span>
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-fg-muted">Loss</span>
            <span className={cn("text-sm font-mono", latestLoss ? "text-fg-body" : "text-fg-muted")}>
              {latestLoss ? latestLoss.toFixed(5) : "—"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-fg-muted">ETA</span>
            <span className="text-sm font-mono text-fg-body">{eta}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-fg-muted">Policy</span>
            <span className="text-sm text-fg-muted">{policyType}</span>
          </div>

          <div className="ml-auto flex items-center gap-4 text-sm text-fg-muted">
            <Cpu size={12} className="text-fg-muted" />
            <span className="font-mono">GPU {gpuSnapshot.util}%</span>
            <span className="font-mono">VRAM {gpuSnapshot.vramUsedGb}/{gpuSnapshot.vramTotalGb} GB</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm text-fg-muted mb-1">
            <span>{progress}%</span>
            <span>{currentStep.toLocaleString()} / {totalSteps.toLocaleString()} steps</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-raised overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 bg-fg"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {lossData.length === 0 && (
          <p className="text-sm text-fg-muted italic">No training signals yet... will appear in chart shortly.</p>
        )}
      </Card>

      <Card title="Loss Trend" bodyClassName={lossData.length > 1 ? "h-64 p-3" : "h-40 p-0"}>
        {lossData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lossData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart["chart-grid"]} vertical={false} />
                <XAxis
                  dataKey="step"
                  tick={{ fontSize: 10, fill: chart["chart-axis"] }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chart["chart-axis"] }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v.toFixed(3)}
                  width={46}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="loss"
                  stroke={chart["chart-series-1"]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <EmptyState compact message="Collecting data…" />
          </div>
        )}
      </Card>

      <TrainOomBanner
        visible={oomDetected}
        onRetry={onRetryAfterOom}
        message="VRAM insufficient. Try reducing Training Steps or switching to CPU/MPS. Retry?"
        retryLabel="Reduce & Retry"
      />
    </div>
  );
}
