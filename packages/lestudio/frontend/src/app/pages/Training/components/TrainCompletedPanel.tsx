import { Link } from "react-router";
import { ArrowRight, CheckCircle2, HardDrive, RotateCcw } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { buttonStyles } from "../../../components/ui/button";
import { Card, RefreshButton } from "../../../components/wireframe";
import type { CheckpointItem } from "../types";
import { CustomTooltip } from "./CustomTooltip";
import { useChartTokens } from "../../../hooks/useChartTokens";

interface TrainCompletedPanelProps {
  policyType: string;
  totalSteps: number;
  latestLoss: number | undefined;
  lossData: { step: number; loss: number }[];
  checkpointList: CheckpointItem[];
  onRefreshCheckpoints: () => void;
  onStartNewTraining: () => void;
}

export function TrainCompletedPanel({
  policyType,
  totalSteps,
  latestLoss,
  lossData,
  checkpointList,
  onRefreshCheckpoints,
  onStartNewTraining,
}: TrainCompletedPanelProps) {
  const chart = useChartTokens();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-ok-line bg-ok-bg">
        <CheckCircle2 size={16} className="text-ok flex-none" />
        <div>
          <span className="text-sm text-ok font-medium">Training Complete</span>
          <span className="text-sm text-fg-muted ml-3">
            {policyType} · {totalSteps.toLocaleString()} steps · Loss {latestLoss?.toFixed(5) ?? "—"}
          </span>
        </div>
      </div>

      {lossData.length > 1 && (
        <Card title="Loss Trend (Final)" bodyClassName="h-48 p-3">
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
        </Card>
      )}

      <Card
        title={`Checkpoints (${checkpointList.length})`}
        action={<RefreshButton onClick={onRefreshCheckpoints} />}
        className="overflow-hidden"
        bodyClassName="p-0 divide-y divide-line-subtle"
      >
        {checkpointList.map((cp) => (
          <div key={cp.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors">
            <HardDrive size={12} className="text-fg-muted flex-none" />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-fg-body font-mono">{cp.name}</span>
              <span className="text-sm text-fg-muted font-mono ml-3">{cp.path}</span>
            </div>
            <span className="text-sm text-fg-muted font-mono flex-none">
              step {cp.step !== null ? cp.step.toLocaleString() : "—"}
            </span>
          </div>
        ))}
      </Card>

      <div className="flex items-center gap-3 justify-end">
        <Link
          to="/eval"
          className={buttonStyles({
            variant: "primary",
            tone: "neutral",
            className: "h-auto px-4 py-2 gap-1.5",
          })}
        >
          <ArrowRight size={12} /> Go to Policy Evaluation
        </Link>
        <button
          onClick={onStartNewTraining}
          className={buttonStyles({
            variant: "secondary",
            tone: "neutral",
            className: "h-auto px-4 py-2 gap-1.5",
          })}
        >
          <RotateCcw size={12} /> Start New Training
        </button>
      </div>
    </div>
  );
}
