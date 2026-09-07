import { Card, StatusBadge } from "../../../components/wireframe";
import { cn } from "../../../components/ui/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { EpisodeResult } from "../../../hooks/useEvalProgress";
import { RewardTooltip } from "./RewardTooltip";
import { useChartTokens } from "../../../hooks/useChartTokens";

export interface EvalProgressPanelProps {
  doneEpisodes: number;
  progressTotal: number | null;
  numEpisodes: number;
  meanReward: number | null;
  computedSuccessRate: number | null;
  bestEp: EpisodeResult | null;
  progressPct: number;
  episodeResults: EpisodeResult[];
  stepDone?: number;
  stepTotal?: number | null;
  runningSuccessRate?: number | null;
}

export function EvalProgressPanel({
  doneEpisodes,
  progressTotal,
  numEpisodes,
  meanReward,
  computedSuccessRate,
  bestEp,
  progressPct,
  episodeResults,
  stepDone = 0,
  stepTotal = null,
  runningSuccessRate = null,
}: EvalProgressPanelProps) {
  const chart = useChartTokens();
  const hasEpisodeProgress = doneEpisodes > 0 || progressTotal !== null;
  const stepPct = stepTotal && stepTotal > 0 ? Math.min(100, (stepDone / stepTotal) * 100) : 0;
  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Evaluation Progress"
        action={<StatusBadge status="running" label="RUNNING" pulse />}
        bodyClassName="flex flex-col gap-4"
      >
        <div className="flex items-center gap-6 flex-wrap">
          {/* Episode count — only show if we actually have episode-level tracking */}
          {hasEpisodeProgress && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-fg-muted">Episode</span>
              <span className="text-sm font-mono text-fg-body">
                {doneEpisodes}
                <span className="text-fg-muted text-sm">
                  {" "}/ {progressTotal ?? numEpisodes}
                </span>
              </span>
            </div>
          )}
          {/* Running success rate from step tqdm postfix */}
          {runningSuccessRate !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-fg-muted">Running Success</span>
              <span className={cn("text-sm font-mono",
                runningSuccessRate >= 60 ? "text-ok"
                : runningSuccessRate >= 40 ? "text-warn"
                : "text-danger"
              )}>
                {runningSuccessRate.toFixed(1)}%
              </span>
            </div>
          )}
          {meanReward !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-fg-muted">Avg Reward</span>
              <span
                className={cn(
                  "text-sm font-mono",
                  (meanReward ?? 0) >= 0.6
                    ? "text-ok"
                    : (meanReward ?? 0) >= 0.4
                      ? "text-warn"
                      : "text-danger",
                )}
              >
                {meanReward.toFixed(3)}
              </span>
            </div>
          )}
          {computedSuccessRate !== null && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-fg-muted">Success Rate</span>
              <span
                className={cn(
                  "text-sm font-mono",
                  (computedSuccessRate ?? 0) >= 60
                    ? "text-ok"
                    : (computedSuccessRate ?? 0) >= 40
                      ? "text-warn"
                      : "text-danger",
                )}
              >
                {computedSuccessRate}%
              </span>
            </div>
          )}
          {bestEp && (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-fg-muted">Best</span>
              <span className="text-sm font-mono text-ok">
                Ep {bestEp.ep} ({bestEp.reward.toFixed(3)})
              </span>
            </div>
          )}
        </div>

        {/* Step-level progress bar (inner rollout tqdm) */}
        {stepTotal !== null && stepTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-fg-muted mb-1">
              <span className="text-fg-muted">Rollout steps</span>
              <span>{stepDone} / {stepTotal} ({Math.round(stepPct)}%)</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 bg-fg-muted"
                style={{ width: `${stepPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Episode-level progress bar (only shown when episode tracking is available) */}
        {hasEpisodeProgress && (
          <div>
            <div className="flex justify-end text-sm text-fg-muted mb-1">
              <span>{Math.round(progressPct)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-raised overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-fg"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {episodeResults.length > 0 && (
        <Card title="Reward per Episode" bodyClassName="h-56 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={episodeResults}
              margin={{ top: 8, right: 8, bottom: 4, left: -12 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={chart["chart-grid"]}
                vertical={false}
              />
              <XAxis
                dataKey="ep"
                tick={{ fontSize: 10, fill: chart["chart-axis"] }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: chart["chart-axis"] }}
                tickLine={false}
                axisLine={false}
                domain={[0, 1]}
                tickFormatter={(v) => v.toFixed(1)}
                width={32}
              />
              <Tooltip content={<RewardTooltip />} />
              <ReferenceLine
                y={0.6}
                stroke={chart["fg-muted"]}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <Bar dataKey="reward" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {episodeResults.map((r) => (
                  <Cell
                    key={r.ep}
                    fill={
                      r.reward >= 0.7
                        ? chart["ok-solid"]
                        : r.reward >= 0.5
                          ? chart["warn-solid"]
                          : chart["danger-solid"]
                    }
                    fillOpacity={r.ep === bestEp?.ep ? 1 : 0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
