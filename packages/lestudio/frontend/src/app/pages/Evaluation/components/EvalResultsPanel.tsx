import { Link } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Trophy,
  TrendingDown,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { buttonStyles } from "../../../components/ui/button";
import { cn } from "../../../components/ui/utils";
import { Card } from "../../../components/wireframe";
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

export interface EvalResultsPanelProps {
  progressStatus: "idle" | "starting" | "running" | "stopped" | "completed" | "error";
  selectedEnvLabel: string;
  envType: string;
  doneEpisodes: number;
  avgReward: number | null;
  computedSuccessRate: number | null;
  finalReward: number | null;
  finalSuccess: number | null;
  bestEp: EpisodeResult | null;
  worstEp: EpisodeResult | null;
  episodeResults: EpisodeResult[];
  onQuickRerun: () => void;
  onStartNewEvaluation: () => void;
}

export function EvalResultsPanel({
  progressStatus,
  selectedEnvLabel,
  envType,
  doneEpisodes,
  avgReward,
  computedSuccessRate,
  finalReward,
  finalSuccess,
  bestEp,
  worstEp,
  episodeResults,
  onQuickRerun,
  onStartNewEvaluation,
}: EvalResultsPanelProps) {
  const chart = useChartTokens();
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg border",
          progressStatus === "error"
            ? "border-danger-line bg-danger-bg"
            : progressStatus === "stopped"
              ? "border-line-strong bg-surface-sunken"
              : "border-ok-line bg-ok-bg",
        )}
      >
        {progressStatus === "error" ? (
          <AlertTriangle
            size={16}
            className="text-danger flex-none"
          />
        ) : (
          <CheckCircle2
            size={16}
            className="text-ok flex-none"
          />
        )}
        <div>
          <span
            className={cn(
              "text-sm font-medium",
              progressStatus === "error"
                ? "text-danger"
                : progressStatus === "stopped"
                  ? "text-fg-muted"
                  : "text-ok",
            )}
          >
            {progressStatus === "error"
              ? "Evaluation Error"
              : progressStatus === "stopped"
                ? "Evaluation Stopped"
                : "Evaluation Complete"}
          </span>
          <span className="text-sm text-fg-muted ml-3">
            {selectedEnvLabel ?? envType} . {doneEpisodes} episodes
            {avgReward !== null && ` . Avg Reward ${avgReward.toFixed(3)}`}
            {computedSuccessRate !== null && ` . Success ${computedSuccessRate}%`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3 rounded-lg border border-line bg-surface-muted">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-fg-muted">Total</span>
          <span className="text-sm font-mono text-fg-body">
            {doneEpisodes} eps
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-fg-muted">Avg Reward</span>
          <span
            className={cn(
              "text-sm font-mono",
              (avgReward ?? 0) >= 0.6
                ? "text-ok"
                : (avgReward ?? 0) >= 0.4
                  ? "text-warn"
                  : "text-danger",
            )}
          >
            {avgReward?.toFixed(3) ?? finalReward?.toFixed(3) ?? "-"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-fg-muted">Success Rate</span>
          <span
            className={cn(
              "text-sm font-mono",
              (computedSuccessRate ?? 0) >= 60
                ? "text-ok"
                : "text-warn",
            )}
          >
            {computedSuccessRate != null
              ? `${computedSuccessRate}%`
              : finalSuccess != null
                ? `${finalSuccess.toFixed(1)}%`
                : "-"}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-fg-muted">Best</span>
          <span className="text-sm font-mono text-ok flex items-center gap-1">
            {bestEp ? (
              <>
                <Trophy size={12} /> Ep {bestEp.ep} ({bestEp.reward.toFixed(3)})
              </>
            ) : (
              "-"
            )}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-fg-muted">Worst</span>
          <span className="text-sm font-mono text-danger flex items-center gap-1">
            {worstEp ? (
              <>
                <TrendingDown size={12} /> Ep {worstEp.ep} ({worstEp.reward.toFixed(3)})
              </>
            ) : (
              "-"
            )}
          </span>
        </div>
      </div>

      {episodeResults.length > 0 && (
        <Card
          title="Reward per Episode"
          bodyClassName="h-56 p-3"
          action={(
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-ok-solid" />
                <span className="text-sm text-fg-muted">&gt;= 0.7</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-warn-solid" />
                <span className="text-sm text-fg-muted">0.5-0.7</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-danger-solid" />
                <span className="text-sm text-fg-muted">&lt; 0.5</span>
              </div>
              <span className="text-sm text-fg-muted">- 0.6 baseline</span>
            </div>
          )}
        >
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

      {episodeResults.length > 0 && (
        <Card
          title={`Episode Details (${episodeResults.length})`}
          className="overflow-hidden"
          bodyClassName="p-0 divide-y divide-line-subtle max-h-52 overflow-y-auto"
        >
          {episodeResults.map((r) => (
            <div
              key={r.ep}
              className={cn(
                "flex items-center gap-3 px-4 py-2 transition-colors",
                r.ep === bestEp?.ep
                  ? "bg-ok-bg"
                  : r.ep === worstEp?.ep
                    ? "bg-danger-bg"
                    : "",
              )}
            >
              <span className="text-sm text-fg-muted font-mono w-14 flex-none flex items-center gap-1">
                {r.ep === bestEp?.ep && (
                  <Trophy
                    size={10}
                    className="text-ok"
                  />
                )}
                {r.ep === worstEp?.ep && (
                  <TrendingDown
                    size={10}
                    className="text-danger"
                  />
                )}
                Ep {r.ep}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-raised overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    r.reward >= 0.7
                      ? "bg-ok-solid"
                      : r.reward >= 0.5
                        ? "bg-warn-solid"
                        : "bg-danger-solid",
                  )}
                  style={{ width: `${r.reward * 100}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-sm font-mono w-12 text-right flex-none",
                  r.reward >= 0.7
                    ? "text-ok"
                    : r.reward >= 0.5
                      ? "text-warn"
                      : "text-danger",
                )}
              >
                {r.reward.toFixed(3)}
              </span>
              {r.frames > 0 && (
                <span className="text-sm text-fg-muted w-16 text-right flex-none font-mono">
                  {r.frames} fr
                </span>
              )}
              <span
                className={cn(
                  "text-sm w-6 text-right flex-none",
                  r.success
                    ? "text-ok"
                    : "text-fg-muted",
                )}
              >
                {r.success ? "✓" : "✗"}
              </span>
            </div>
          ))}
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-end">
        <button
          onClick={onQuickRerun}
          className={buttonStyles({
            variant: "primary",
            tone: "success",
            className: "h-auto px-4 py-2 gap-1.5",
          })}
        >
          <RotateCcw size={12} /> Quick Rerun (3 ep)
        </button>
        <button
          onClick={onStartNewEvaluation}
          className={buttonStyles({
            variant: "secondary",
            tone: "neutral",
            className: "h-auto px-4 py-2 gap-1.5",
          })}
        >
          <RotateCcw size={12} /> Start New Evaluation
        </button>
        <Link
          to="/train"
          className={buttonStyles({
            variant: "secondary",
            tone: "neutral",
            className: "h-auto px-4 py-2 gap-1.5",
          })}
        >
          <ArrowRight size={12} /> Go to Training
        </Link>
        <Link
          to="/record"
          className={buttonStyles({
            variant: "secondary",
            tone: "neutral",
            className: "h-auto px-4 py-2 gap-1.5",
          })}
        >
          <ArrowRight size={12} /> Record New Data
        </Link>
      </div>
    </div>
  );
}
