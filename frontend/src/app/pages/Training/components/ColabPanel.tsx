import { CheckCircle2, ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, Upload } from "lucide-react";

import { buttonStyles } from "../../../components/ui/button";
import { cn } from "../../../components/ui/utils";
import { HfGateBanner } from "./HfGateBanner";

interface ColabPanelProps {
  colabOpen: boolean;
  setColabOpen: (value: boolean) => void;
  hfAuth: string;
  colabRepoId: string;
  selectedRepoId: string;
  pushState: "idle" | "pushing" | "done";
  onPushToHub: () => void;
  handleCopySnippet: () => void;
  colabCopied: boolean;
  colabSnippet: string;
  handleOpenColab: () => void;
  colabStarting: boolean;
  device: string;
}

export function ColabPanel({
  colabOpen,
  setColabOpen,
  hfAuth,
  colabRepoId,
  selectedRepoId,
  pushState,
  onPushToHub,
  handleCopySnippet,
  colabCopied,
  colabSnippet,
  handleOpenColab,
  colabStarting,
  device,
}: ColabPanelProps) {
  return (
    <div className="rounded-lg border border-line bg-surface overflow-hidden">
      <button
        onClick={() => setColabOpen(!colabOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-muted border-b border-line gap-2 cursor-pointer hover:bg-surface-hover transition-colors"
      >
        <img src="/colab-logo.png" alt="" aria-hidden="true" className="size-3.5 object-contain" />
        <span className="text-sm font-medium text-fg-body">Colab Training</span>
        <span className="text-sm text-fg-muted ml-1">Train on Google Colab when you don't have a GPU</span>
        {colabOpen ? <ChevronUp size={10} className="ml-auto text-fg-muted" /> : <ChevronDown size={10} className="ml-auto text-fg-muted" />}
      </button>
      {colabOpen && (
        <div className="px-4 py-4 flex flex-col gap-4">
          {hfAuth !== "ready" && (
            <HfGateBanner authState={hfAuth} level="hf_write" />
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex-none size-5 rounded-full bg-ok-bg text-ok text-3xs font-bold grid place-items-center leading-[0]">1</span>
            <p className="text-sm text-fg-body font-medium">Upload dataset to HF Hub</p>
            <code className="text-2xs text-fg-muted bg-surface-sunken px-1.5 py-0.5 rounded truncate">
              {colabRepoId || selectedRepoId || "lerobot-user/pick_cube"}
            </code>
            <button
              disabled={hfAuth !== "ready" || pushState !== "idle"}
              onClick={onPushToHub}
              className={cn(
                buttonStyles({
                  variant: "secondary",
                  tone: "neutral",
                  className: "h-auto px-4 py-1.5 gap-1.5 whitespace-nowrap",
                }),
                hfAuth !== "ready" ? "opacity-40 cursor-not-allowed"
                  : pushState === "pushing" ? "opacity-70 cursor-wait"
                  : pushState === "done" ? "cursor-default"
                  : null
              )}
            >
              {pushState === "pushing" ? <Loader2 size={12} className="animate-spin" />
                : pushState === "done" ? <CheckCircle2 size={12} />
                : <Upload size={12} />}
              {pushState === "pushing" ? "Pushing…" : pushState === "done" ? "Pushed!" : "Push to Hub"}
            </button>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex-none size-5 rounded-full bg-ok-bg text-ok text-3xs font-bold grid place-items-center leading-[0] mt-0.5">2</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-fg-body font-medium mb-1.5">Paste config snippet into Colab</p>
              <div className="relative rounded border border-line-control bg-surface-sunken overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-line-control">
                  <span className="text-sm text-fg-muted font-mono">python</span>
                  <button
                    onClick={handleCopySnippet}
                    disabled={hfAuth !== "ready"}
                    className={cn(
                      "flex items-center gap-1 text-sm transition-colors",
                      hfAuth !== "ready" ? "text-fg-disabled cursor-not-allowed" : "text-fg-muted hover:text-fg-body cursor-pointer"
                    )}
                  >
                    <Copy size={10} />
                    {colabCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="p-3 text-sm text-fg-body font-mono overflow-auto leading-relaxed whitespace-pre max-h-48">
                  {colabSnippet}
                </pre>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex-none size-5 rounded-full bg-ok-bg text-ok text-3xs font-bold grid place-items-center leading-[0]">3</span>
            <p className="text-sm text-fg-body font-medium">Open and run Colab notebook</p>
            <button
              type="button"
              onClick={handleOpenColab}
              disabled={hfAuth !== "ready" || colabStarting}
              className={cn(
                buttonStyles({
                  variant: "secondary",
                  tone: "neutral",
                  className: "h-auto px-4 py-1.5 gap-1.5 whitespace-nowrap",
                }),
                hfAuth !== "ready" ? "opacity-40 cursor-not-allowed"
                  : colabStarting ? "opacity-70 cursor-wait"
                  : null
              )}
            >
              {colabStarting ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              {colabStarting ? "Opening..." : "Open Colab Notebook"}
            </button>
          </div>

          {device === "MPS (Apple Silicon)" && (
            <p className="text-sm text-warn">
              ⚠ Colab automatically uses CUDA instead of MPS.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
