import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { KeyRound, Moon, Sun, Menu } from "lucide-react";
import { buttonStyles } from "../../ui/button";
import { cn } from "../../ui/utils";
import { useTheme } from "../../../theme-context";
import { useHfAuth } from "../../../hf-auth-context";
import { apiDelete, apiPost } from "../../../services/apiClient";
import {
  clearStoredSessionToken,
  describeApiOrigin,
  isRemoteApiOrigin,
  readStoredSessionToken,
  resolveApiOrigin,
  writeStoredSessionToken,
} from "../../../services/sessionToken";
import { useLeStudioStore } from "../../../store";
import { Popover, PopoverTrigger, PopoverContent } from "../../ui/popover";


export function Header({
  onToggleSidebar,
  onMobileToggle,
}: {
  onToggleSidebar: () => void;
  onMobileToggle: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const wsReady = useLeStudioStore((s) => s.wsReady);
  const wsStatus: "connected" | "disconnected" = wsReady ? "connected" : "disconnected";
  const { hfAuth, refreshHfAuth } = useHfAuth();
  const hfUsername = useLeStudioStore((s) => s.hfUsername);
  const addToast = useLeStudioStore((s) => s.addToast);
  const [hfTokenInput, setHfTokenInput] = useState("");
  const [savingHfToken, setSavingHfToken] = useState(false);
  const [deletingHfToken, setDeletingHfToken] = useState(false);
  const [hfPopoverOpen, setHfPopoverOpen] = useState(false);
  const apiOrigin = useMemo(() => {
    const windowOrigin = typeof window === "undefined" ? "" : window.location.origin;
    return resolveApiOrigin(String(import.meta.env.VITE_API_BASE_URL ?? ""), windowOrigin);
  }, []);
  const remoteSessionEnabled = isRemoteApiOrigin(apiOrigin);
  const [remotePopoverOpen, setRemotePopoverOpen] = useState(false);
  const [sessionTokenInput, setSessionTokenInput] = useState("");
  const [sessionTokenSaved, setSessionTokenSaved] = useState(() => (
    typeof window !== "undefined"
      ? !!readStoredSessionToken(apiOrigin, window.localStorage)
      : false
  ));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (typeof window === "undefined") return;
      const stored = readStoredSessionToken(apiOrigin, window.localStorage);
      setSessionTokenSaved(!!stored);
      setSessionTokenInput(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [apiOrigin]);

  const remoteLabel = sessionTokenSaved ? "Remote OK" : "Remote";
  const remoteTitle = sessionTokenSaved
    ? `Session token saved for ${describeApiOrigin(apiOrigin)}`
    : `Session token required for remote changes on ${describeApiOrigin(apiOrigin)}`;

  const wsColor = {
    connected: "bg-emerald-400",
    unstable: "bg-amber-400",
    disconnected: "bg-red-400",
  }[wsStatus];

  const hfLabel = hfAuth === "ready"
    ? (hfUsername ?? "Connected")
    : hfAuth === "missing_token"
      ? "No Token"
      : hfAuth === "expired_token"
        ? "Expired"
      : "Invalid";

  const hfTitle = hfAuth === "ready"
    ? (hfUsername ? `Hugging Face Account Connected: ${hfUsername}` : "Hugging Face token is properly connected")
    : hfAuth === "missing_token"
      ? "Hugging Face token is not configured"
      : hfAuth === "expired_token"
        ? "Hugging Face token has expired"
      : "Hugging Face token is invalid";

  return (
    <header className="h-12 flex-none flex items-center gap-2 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-50">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded cursor-pointer hidden md:block"
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <Menu size={15} />
      </button>
      <button
        onClick={onMobileToggle}
        className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded cursor-pointer md:hidden"
        title="Open menu"
        aria-label="Open menu"
      >
        <Menu size={15} />
      </button>

      <NavLink to="/" className="flex items-center gap-1.5 mr-4 hover:opacity-75 transition-opacity">
        <svg className="size-6 text-zinc-700 dark:text-zinc-300" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <mask id="planet-mask">
              <rect width="100" height="100" fill="white" />
              <path d="M 0,50 A 50,16 0 0,0 100,50" fill="none" stroke="black" strokeWidth="12" transform="rotate(-15 50 50)" />
            </mask>
          </defs>
          <circle cx="50" cy="50" r="34" mask="url(#planet-mask)" />
          <ellipse cx="50" cy="50" rx="48" ry="16" transform="rotate(-15 50 50)" />
        </svg>
        <span className="text-sm text-zinc-800 dark:text-zinc-200">LeStudio</span>
        <span className="text-[10px] font-bold tracking-wide uppercase leading-none px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400">ALPHA</span>
      </NavLink>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        {remoteSessionEnabled && (
          <Popover open={remotePopoverOpen} onOpenChange={setRemotePopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded border text-sm cursor-pointer transition-colors",
                  sessionTokenSaved
                    ? "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                    : "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5",
                )}
                title={remoteTitle}
                aria-label={remoteTitle}
              >
                <KeyRound size={12} />
                <span>{remoteLabel}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 p-0">
              <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Remote Session Token</span>
                  <span className="text-xs text-zinc-400 font-mono">{describeApiOrigin(apiOrigin)}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Remote LeStudio changes require the session token printed by the server at startup.
                </p>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <input
                  type="password"
                  value={sessionTokenInput}
                  onChange={(e) => setSessionTokenInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const token = sessionTokenInput.trim();
                    if (typeof window === "undefined") return;
                    if (!token) {
                      addToast("Enter session token.", "error");
                      return;
                    }
                    writeStoredSessionToken(apiOrigin, token, window.localStorage);
                    setSessionTokenSaved(true);
                    setSessionTokenInput(token);
                    addToast("Remote session token saved.", "success");
                    setRemotePopoverOpen(false);
                  }}
                  placeholder="Paste LeStudio token"
                  aria-label="LeStudio session token"
                  className="w-full px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const token = sessionTokenInput.trim();
                      if (typeof window === "undefined") return;
                      if (!token) {
                        addToast("Enter session token.", "error");
                        return;
                      }
                      writeStoredSessionToken(apiOrigin, token, window.localStorage);
                      setSessionTokenSaved(true);
                      setSessionTokenInput(token);
                      addToast("Remote session token saved.", "success");
                      setRemotePopoverOpen(false);
                    }}
                    className={buttonStyles({
                      variant: "primary",
                      tone: "neutral",
                      className: "flex-1 h-auto px-3 py-1.5 justify-center",
                    })}
                    disabled={!sessionTokenInput.trim()}
                  >
                    Save Token
                  </button>
                  <button
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      clearStoredSessionToken(apiOrigin, window.localStorage);
                      setSessionTokenSaved(false);
                      setSessionTokenInput("");
                      addToast("Remote session token cleared.", "success");
                    }}
                    className={buttonStyles({
                      variant: "secondary",
                      tone: "danger",
                      className: "h-auto px-3 py-1.5 justify-center",
                    })}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Popover open={hfPopoverOpen} onOpenChange={setHfPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded border text-sm cursor-pointer transition-colors",
                hfAuth === "ready"
                  ? "border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                  : hfAuth === "missing_token"
                    ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                    : hfAuth === "expired_token"
                      ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                    : "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5"
              )}
              title={hfTitle}
              aria-label={`Hugging Face status: ${hfLabel}`}
            >
              <span aria-hidden="true">🤗</span>
              <span>{hfLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 p-0">
            <div className="px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Hugging Face</span>
                {hfAuth !== "ready" && (
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors whitespace-nowrap flex-none"
                  >
                    Get Token →
                  </a>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">{hfTitle}</p>
            </div>
            <div className="p-3 flex flex-col gap-2">
              {hfAuth === "ready" ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400 flex-none" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-200">{hfUsername ?? "Connected"}</span>
                  </div>
                  <button
                    onClick={async () => {
                      setDeletingHfToken(true);
                      try {
                        await apiDelete<{ ok?: boolean }>("/api/hf/token");
                        await refreshHfAuth();
                        addToast("HF token deleted.", "success");
                      } catch {
                        addToast("Failed to delete HF token.", "error");
                      } finally {
                        setDeletingHfToken(false);
                      }
                    }}
                    disabled={deletingHfToken}
                    className={buttonStyles({
                      variant: "secondary",
                      tone: "danger",
                      className: "w-full h-auto px-3 py-1.5 justify-center",
                    })}
                  >
                    {deletingHfToken ? "Deleting..." : "Delete Token"}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="password"
                    value={hfTokenInput}
                    onChange={(e) => setHfTokenInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && hfTokenInput.trim()) {
                        e.preventDefault();
                        const token = hfTokenInput.trim();
                        setSavingHfToken(true);
                        void apiPost<{ ok?: boolean; error?: string }>("/api/hf/token", { token }).then(async (result) => {
                          if (result?.ok) {
                            setHfTokenInput("");
                            await refreshHfAuth();
                            addToast("HF token saved.", "success");
                            setHfPopoverOpen(false);
                          } else {
                            addToast(result?.error ?? "Failed to save HF token.", "error");
                          }
                        }).catch(() => {
                          addToast("Failed to save HF token.", "error");
                        }).finally(() => {
                          setSavingHfToken(false);
                        });
                      }
                    }}
                    placeholder="hf_..."
                    aria-label="Hugging Face access token"
                    className="w-full px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-500 transition-colors"
                  />
                  <button
                    onClick={async () => {
                      const token = hfTokenInput.trim();
                      if (!token) { addToast("Enter HF token.", "error"); return; }
                      setSavingHfToken(true);
                      try {
                        const result = await apiPost<{ ok?: boolean; error?: string }>("/api/hf/token", { token });
                        if (result?.ok) {
                          setHfTokenInput("");
                          await refreshHfAuth();
                          addToast("HF token saved.", "success");
                          setHfPopoverOpen(false);
                        } else {
                          addToast(result?.error ?? "Failed to save HF token.", "error");
                        }
                      } catch {
                        addToast("Failed to save HF token.", "error");
                      } finally {
                        setSavingHfToken(false);
                      }
                    }}
                    disabled={savingHfToken || !hfTokenInput.trim()}
                    className={buttonStyles({
                      variant: "primary",
                      tone: "neutral",
                      className: "w-full h-auto px-3 py-1.5 justify-center",
                    })}
                  >
                    {savingHfToken ? "Saving..." : "Save Token"}
                  </button>
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700" title={`WebSocket: ${wsStatus}`}>
          <span className={cn("size-2 rounded-full", wsColor)} />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">WS</span>
        </div>

        <div className="mx-0.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        <button
          onClick={toggleTheme}
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <a
          href="https://github.com/TheMomentLab/lerobot-studio"
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
          title="GitHub"
          aria-label="Open GitHub repository"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>

      </div>
    </header>
  );
}
