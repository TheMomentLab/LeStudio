import { useEffect, useState } from "react";
import { Cloud, Download, ExternalLink, HardDrive, Heart, Search } from "lucide-react";
import { Card, EmptyState, inputClassName } from "../../../components/wireframe";
import { cn } from "../../../components/ui/utils";

import { buttonStyles } from "../../../components/ui/button";
import { useHfAuth } from "../../../hf-auth-context";
import { apiGet, apiPost } from "../../../services/apiClient";
import { buildHubSearchPath, fromBackendHubSearch } from "../../../services/contracts";
import { useLeStudioStore } from "../../../store";
import type {
  HubDownloadStartResponse,
  HubDownloadStatusResponse,
  HubResult,
  MyHubDataset,
  MyHubDatasetsResponse,
} from "../types";

export function HubSearchPanel() {
  const addToast = useLeStudioStore((s) => s.addToast);
  const { hfAuth } = useHfAuth();
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [hubResults, setHubResults] = useState<HubResult[]>([]);
  const [myHubDatasets, setMyHubDatasets] = useState<MyHubDataset[]>([]);
  const [myHubUsername, setMyHubUsername] = useState("lerobot-user");
  const [myHubLoading, setMyHubLoading] = useState(false);
  const [myHubReloadToken, setMyHubReloadToken] = useState(0);
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [downloadJobs, setDownloadJobs] = useState<Record<string, string>>({});
  const [downloadNotes, setDownloadNotes] = useState<Record<string, string>>({});

  const setDownloadProgress = (repoId: string, rawProgress: unknown) => {
    const numeric = typeof rawProgress === "number" ? rawProgress : Number(rawProgress ?? 0);
    const clamped = Math.max(0, Math.min(100, Number.isFinite(numeric) ? numeric : 0));
    setDownloading((prev) => ({ ...prev, [repoId]: clamped }));
  };

  const clearDownloadUi = (repoId: string) => {
    setDownloading((prev) => {
      const next = { ...prev };
      delete next[repoId];
      return next;
    });
    setDownloadNotes((prev) => {
      const next = { ...prev };
      delete next[repoId];
      return next;
    });
  };

  const doSearch = () => {
    if (!query.trim()) return;
    apiGet<unknown>(buildHubSearchPath(query.trim())).then((res) => {
      setHubResults(fromBackendHubSearch(res));
      setSearched(true);
    });
  };

  const startDownload = async (repoId: string) => {
    if (downloadJobs[repoId]) return;

    setDownloadProgress(repoId, 0);
    setDownloadNotes((prev) => ({ ...prev, [repoId]: "Preparing download job..." }));

    try {
      const started = await apiPost<HubDownloadStartResponse>("/api/hub/datasets/download", {
        repo_id: repoId,
      });

      if (!started.ok || !started.job_id) {
        clearDownloadUi(repoId);
        addToast(started.error ?? "Failed to start download job.", "error");
        return;
      }

      setDownloadJobs((prev) => ({ ...prev, [repoId]: started.job_id as string }));
      addToast(`Download started: ${repoId}`, "info");
    } catch (error) {
      clearDownloadUi(repoId);
      addToast(error instanceof Error ? error.message : "Download request failed", "error");
    }
  };

  useEffect(() => {
    if (hfAuth !== "ready") {
      const timer = window.setTimeout(() => {
        setMyHubLoading(false);
        setMyHubDatasets([]);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setMyHubLoading(true);

      void apiGet<MyHubDatasetsResponse>("/api/hf/my-datasets?limit=50")
        .then((res) => {
          if (cancelled) return;
          if (res.ok) {
            setMyHubDatasets(Array.isArray(res.datasets) ? res.datasets : []);
            setMyHubUsername(typeof res.username === "string" && res.username ? res.username : "lerobot-user");
            return;
          }
          setMyHubDatasets([]);
        })
        .catch(() => {
          if (cancelled) return;
          setMyHubDatasets([]);
        })
        .finally(() => {
          if (!cancelled) setMyHubLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hfAuth, myHubReloadToken]);

  useEffect(() => {
    const jobs = Object.entries(downloadJobs);
    if (jobs.length === 0) return;

    let cancelled = false;

    const pollOnce = async () => {
      for (const [repoId, jobId] of jobs) {
        try {
          const status = await apiGet<HubDownloadStatusResponse>(`/api/hub/datasets/download/status/${encodeURIComponent(jobId)}`);

          if (!status.ok) {
            setDownloadJobs((prev) => {
              const next = { ...prev };
              delete next[repoId];
              return next;
            });
            clearDownloadUi(repoId);
            if (!cancelled) addToast(status.error ?? `Failed to check download status: ${repoId}`, "error");
            continue;
          }

          setDownloadProgress(repoId, status.progress);
          if (Array.isArray(status.logs) && status.logs.length > 0) {
            const tail = String(status.logs[status.logs.length - 1] ?? "").trim();
            if (tail) {
              setDownloadNotes((prev) => ({ ...prev, [repoId]: tail }));
            }
          }

          const phase = String(status.status ?? "running");
          if (phase === "success") {
            setDownloadJobs((prev) => {
              const next = { ...prev };
              delete next[repoId];
              return next;
            });
            setDownloadProgress(repoId, 100);
            if (!cancelled) addToast(`Download complete: ${repoId}`, "success");
            setMyHubReloadToken((prev) => prev + 1);
            window.setTimeout(() => {
              if (!cancelled) clearDownloadUi(repoId);
            }, 1200);
            continue;
          }

          if (phase === "error") {
            setDownloadJobs((prev) => {
              const next = { ...prev };
              delete next[repoId];
              return next;
            });
            clearDownloadUi(repoId);
            if (!cancelled) {
              addToast(status.error ?? `Download failed: ${repoId}`, "error");
            }
          }
        } catch (error) {
          setDownloadJobs((prev) => {
            const next = { ...prev };
            delete next[repoId];
            return next;
          });
          clearDownloadUi(repoId);
          if (!cancelled) {
            addToast(error instanceof Error ? error.message : `Failed to check download status: ${repoId}`, "error");
          }
        }
      }
    };

    void pollOnce();
    const timer = window.setInterval(() => {
      void pollOnce();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [addToast, downloadJobs]);

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Hub — dataset ID, tags, keywords..."
            aria-label="Search Hugging Face datasets"
            className={cn(inputClassName, "pl-9")}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
        </div>
        <button
          onClick={doSearch}
          className={buttonStyles({
            variant: "primary",
            tone: "neutral",
            className: "h-9 px-4 hover:opacity-90",
          })}
        >
          Search
        </button>
      </div>

      {/* Search Results */}
      {searched && (
        <Card
          title={`Search Results (${hubResults.length})`}
          action={<button onClick={() => setSearched(false)} className="text-sm text-fg-muted hover:text-fg-body transition-colors cursor-pointer">Close</button>}
          className="overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
          bodyClassName="p-0 divide-y divide-line"
        >
            {hubResults.length === 0 ? (
              <EmptyState compact icon={<Search size={20} />} message="No search results found." />
            ) : hubResults.map((r) => {
              const progress = downloading[r.id];
              const isDownloading = progress !== undefined;
              const note = downloadNotes[r.id];

              return (
                <div key={r.id} className="group relative flex items-center justify-between px-3 py-2.5 hover:bg-surface-hover transition-colors">
                  {isDownloading && (
                    <div
                      className="absolute inset-0 bg-ok-bg z-0 pointer-events-none transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  )}

                  <div className="relative z-10 flex flex-col gap-1 min-w-0 flex-1 mr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-medium text-info">{r.id}</span>
                      {r.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded bg-surface-sunken text-sm text-fg-muted border border-line-control">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-fg-muted truncate">{r.desc}</p>
                    {note && (
                      <p className="text-xs text-fg-muted truncate">{note}</p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-fg-muted mt-0.5">
                      <span className="flex items-center gap-1"><Download size={10} /> {r.downloads.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Heart size={10} className="text-danger" /> {r.likes}</span>
                      <span>Updated {r.modified}</span>
                    </div>
                  </div>

                  <div className="relative z-10 flex-none">
                    {isDownloading ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded bg-surface-sunken text-sm font-mono text-fg-muted">
                        <span className="w-8 text-right">{progress}%</span>
                        <div className="w-16 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                          <div className="h-full bg-ok-solid transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { void startDownload(r.id); }}
                        className={buttonStyles({
                          variant: "secondary",
                          tone: "neutral",
                          className: "h-auto px-4 py-2 gap-1.5",
                        })}
                      >
                        <Download size={12} />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </Card>
      )}

      {/* My Hub Datasets */}
      <Card
        title="My Hub Datasets"
        titleSub={`${myHubDatasets.length} items`}
        action={(
          <a href={`https://huggingface.co/${myHubUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg-body transition-colors">
            Hub Profile <ExternalLink size={10} />
          </a>
        )}
        className="overflow-hidden"
        bodyClassName="p-0 divide-y divide-line"
      >
          {myHubLoading ? (
            <EmptyState compact message="Loading your Hub datasets…" />
          ) : myHubDatasets.length === 0 ? (
            <EmptyState compact icon={<Cloud size={20} />} message="No Hub datasets found." />
          ) : myHubDatasets.map((ds) => (
            <div key={ds.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-hover transition-colors">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1 mr-4">
                <div className="flex items-center gap-2">
                  <a href={`https://huggingface.co/datasets/${ds.id}`} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-medium text-info hover:underline">{ds.id}</a>
                  {ds.local_sync && (
                    <span title="Synced locally" className="flex-none inline-flex"><HardDrive size={14} className="text-ok" aria-label="Synced locally" /></span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-fg-muted">
                  <span className="flex items-center gap-1"><Download size={10} /> {ds.downloads}</span>
                  <span className="flex items-center gap-1"><Heart size={10} className="text-danger" /> {ds.likes}</span>
                  <span>{ds.size}</span>
                  <span>Updated {ds.modified}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-none">
                {!ds.local_sync && (
                  <button
                    onClick={() => { void startDownload(ds.id); }}
                    className={buttonStyles({
                      variant: "secondary",
                      tone: "neutral",
                      className: "h-auto px-4 py-2 gap-1.5",
                    })}
                  >
                    <Download size={12} /> Pull
                  </button>
                )}
                <a href={`https://huggingface.co/datasets/${ds.id}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-fg-muted hover:text-fg-body transition-colors">
                  <span className="sr-only">Open {ds.id} on Hugging Face</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
      </Card>
    </div>
  );
}
