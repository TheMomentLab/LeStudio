import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CheckCircle2, Film, Play, RefreshCw, ThumbsDown, ThumbsUp, Zap } from "lucide-react";

import { buttonStyles } from "../../../components/ui/button";
import { apiGet, apiPost } from "../../../services/apiClient";
import { useLeStudioStore } from "../../../store";
import type {
  BulkTagsResponse,
  DatasetStatsResponse,
  EpisodeStat,
  StatsRecomputeResponse,
  StatsStatusResponse,
  TagType,
} from "../types";
import { parseDatasetId } from "../utils";

export function AutoFlagPanelContent({
  datasetId,
  totalEpisodes,
  tags,
  onTagsChanged,
  onPreviewEpisode,
}: {
  datasetId: string;
  totalEpisodes: number;
  tags: Record<string, TagType>;
  onTagsChanged: () => void;
  onPreviewEpisode?: (episodeIndex: number) => void;
}) {
  const addToast = useLeStudioStore((s) => s.addToast);
  const parsed = parseDatasetId(datasetId);
  const [stats, setStats] = useState<EpisodeStat[]>([]);
  const [jobId, setJobId] = useState("");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobPhase, setJobPhase] = useState("idle");
  const [tagging, setTagging] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const didAutoRun = useRef(false);

  const flagged = useMemo(
    () => stats.filter((ep) => ep.frames < 30 || ep.movement < 0.01 || ep.jerk_score > 5),
    [stats],
  );

  const pendingFlagged = useMemo(
    () => flagged.filter((ep) => tags[String(ep.episode_index)] !== "bad"),
    [flagged, tags],
  );

  const fetchStats = useCallback(async (): Promise<boolean> => {
    if (!parsed) return false;
    const res = await apiGet<DatasetStatsResponse>(
      `/api/datasets/${encodeURIComponent(parsed.user)}/${encodeURIComponent(parsed.repo)}/stats`,
    );
    if (!res.ok || !Array.isArray(res.episodes)) {
      return false;
    }
    setStats(res.episodes);
    return res.episodes.length > 0;
  }, [parsed]);

  const handleRecompute = useCallback(async () => {
    if (!parsed) return;
    try {
      const res = await apiPost<StatsRecomputeResponse>(
        `/api/datasets/${encodeURIComponent(parsed.user)}/${encodeURIComponent(parsed.repo)}/stats/recompute`,
        { force: true },
      );
      if (!res.ok) {
        addToast(res.error ?? "Failed to recompute stats", "error");
        return;
      }
      if (!res.job_id) {
        await fetchStats();
        return;
      }
      setJobId(res.job_id);
      setJobProgress(0);
      setJobPhase("queued");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Failed to recompute stats", "error");
    }
  }, [addToast, fetchStats, parsed]);

  const handleBulkTag = async () => {
    if (!parsed || pendingFlagged.length === 0) return;
    setTagging(true);
    try {
      const updates = pendingFlagged.map((ep) => ({ episode_index: ep.episode_index, tag: "bad" as const }));
      const res = await apiPost<BulkTagsResponse>(
        `/api/datasets/${encodeURIComponent(parsed.user)}/${encodeURIComponent(parsed.repo)}/tags/bulk`,
        { updates },
      );
      if (!res.ok) {
        addToast(res.error ?? "Bulk tagging failed", "error");
        return;
      }
      addToast(`Bulk tagging complete: ${res.applied ?? pendingFlagged.length} episodes`, "success");
      onTagsChanged();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Bulk tagging failed", "error");
    } finally {
      setTagging(false);
    }
  };

  const handleSingleTag = async (episodeIndex: number, tag: TagType) => {
    if (!parsed) return;
    try {
      await apiPost(`/api/datasets/${encodeURIComponent(parsed.user)}/${encodeURIComponent(parsed.repo)}/tags`, { episode_index: episodeIndex, tag });
      onTagsChanged();
    } catch (err) {
      addToast(`Tag failed: ${String(err)}`, "error");
    }
  };

  const handleDismiss = async (episodeIndex: number) => { await handleSingleTag(episodeIndex, "good"); };

  const getViolations = (ep: EpisodeStat) => {
    const v: string[] = [];
    if (ep.frames < 30) v.push("frames");
    if (ep.movement < 0.01) v.push("motion");
    if (ep.jerk_score > 5) v.push("jerk");
    return v;
  };

  const handleCancelJob = async () => {
    if (!jobId) return;
    await apiPost(`/api/datasets/stats/cancel/${encodeURIComponent(jobId)}`);
  };

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(async () => {
      const status = await apiGet<StatsStatusResponse>(`/api/datasets/stats/status/${encodeURIComponent(jobId)}`);
      if (!status.ok) {
        setJobId("");
        addToast(status.error ?? "Stats job failed", "error");
        return;
      }
      const state = String(status.status ?? "running");
      setJobPhase(String(status.phase ?? state));
      setJobProgress(Math.max(0, Math.min(100, Number(status.progress ?? 0))));
      if (state === "success") {
        setJobId("");
        void fetchStats();
      }
      if (state === "error" || state === "cancelled") {
        setJobId("");
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [addToast, fetchStats, jobId]);

  // Auto-run on tab mount: try cached stats first, if none then recompute
  useEffect(() => {
    if (didAutoRun.current || !parsed) return;
    didAutoRun.current = true;
    (async () => {
      const hasCached = await fetchStats();
      if (!hasCached) {
        await handleRecompute();
      }
      setInitialLoading(false);
    })();
  }, [fetchStats, handleRecompute, parsed]);

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Loading / computing state */}
      {(initialLoading || jobId) && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <RefreshCw size={20} className="text-fg-muted animate-spin" />
          <span className="text-sm text-fg-muted">
            {jobId ? `${jobPhase}... ${jobProgress}%` : "Loading stats..."}
          </span>
          {jobId && (
            <button
              onClick={() => { void handleCancelJob(); }}
              className={buttonStyles({ variant: "secondary", tone: "danger", size: "sm" })}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {!initialLoading && !jobId && (
        <>
          {/* Criteria pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-fg-muted">Criteria</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-surface-sunken text-fg-muted border border-line-control"><Film size={10} /> frames &lt; 30</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-surface-sunken text-fg-muted border border-line-control"><Activity size={10} /> motion &lt; 0.01</span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-surface-sunken text-fg-muted border border-line-control"><Zap size={10} /> jerk &gt; 5.0</span>
            <div className="flex-1" />
            <button
              onClick={() => { void handleRecompute(); }}
              className="p-1.5 text-fg-muted hover:text-fg-body transition-colors"
              title="Recompute Stats"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {flagged.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-ok">
              <CheckCircle2 size={14} />
              All {totalEpisodes} episodes passed
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-fg-body">{flagged.length} / {totalEpisodes} flagged</span>
                  <span className="text-sm text-fg-muted">{pendingFlagged.length} unreviewed</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                  <div className="h-full rounded-full bg-ok-solid transition-all" style={{ width: `${((flagged.length - pendingFlagged.length) / flagged.length) * 100}%` }} />
                </div>
              </div>

              {/* Episode cards */}
              <div className="max-h-64 overflow-auto space-y-2">
                {flagged.map((ep) => (
                  <div key={ep.episode_index} className="rounded-lg border border-line p-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-fg-body">Ep {ep.episode_index}</span>
                        {getViolations(ep).map((v) => (
                          <span key={v} className="text-warn" title={v}>
                            {v === "frames" && <Film size={12} />}
                            {v === "motion" && <Activity size={12} />}
                            {v === "jerk" && <Zap size={12} />}
                          </span>
                        ))}
                        {tags[String(ep.episode_index)] === "bad" && (
                          <ThumbsDown size={12} className="text-fg-muted" />
                        )}
                        {tags[String(ep.episode_index)] === "good" && (
                          <ThumbsUp size={12} className="text-ok" />
                        )}
                      </div>
                      <div className="text-xs text-fg-muted">{ep.frames} frames · motion {ep.movement.toFixed(3)} · jerk {ep.jerk_score.toFixed(3)}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-none">
                      {onPreviewEpisode && (
                        <button onClick={() => onPreviewEpisode(ep.episode_index)} className="p-1.5 rounded text-fg-muted hover:text-info hover:bg-info-bg transition-colors cursor-pointer" title="Preview in Playback">
                          <Play size={12} />
                        </button>
                      )}
                      {tags[String(ep.episode_index)] !== "bad" && tags[String(ep.episode_index)] !== "good" && (
                        <>
                          <button onClick={() => { void handleSingleTag(ep.episode_index, "bad"); }} className="p-1.5 rounded text-fg-muted hover:text-fg-body hover:bg-surface-hover transition-colors cursor-pointer" title="Tag as Bad">
                            <ThumbsDown size={12} />
                          </button>
                          <button onClick={() => { void handleDismiss(ep.episode_index); }} className="p-1.5 rounded text-fg-muted hover:text-ok hover:bg-ok-bg transition-colors cursor-pointer" title="Dismiss (not bad)">
                            <ThumbsUp size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom action / completion signal */}
              {pendingFlagged.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-ok py-2">
                  <CheckCircle2 size={14} />
                  All flagged episodes reviewed
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { void handleBulkTag(); }}
                  disabled={tagging}
                  className={buttonStyles({
                    variant: "secondary",
                    tone: "danger",
                    className: "w-full h-auto py-2",
                  })}
                >
                  {tagging ? "Tagging..." : `Bulk tag ${pendingFlagged.length} remaining as Bad`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
