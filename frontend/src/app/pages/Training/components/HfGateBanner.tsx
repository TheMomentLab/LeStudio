import { Lock } from "lucide-react";

import type { HfGateBannerProps } from "../types";

export function HfGateBanner({ authState, level }: HfGateBannerProps) {
  const requirement = level === "hf_write" ? "write" : "read";
  return (
    <div className="rounded-lg border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn flex items-center gap-2">
      <Lock size={14} className="flex-none" />
      <span>
        Hugging Face auth required ({requirement}). Current state: <span className="font-mono">{authState}</span>
      </span>
    </div>
  );
}
