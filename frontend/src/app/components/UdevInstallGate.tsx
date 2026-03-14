import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { apiGet, apiPost } from "../services/apiClient";

type RulesStatus = {
  rules_installed: boolean;
  install_needed: boolean;
  needs_root_for_install: boolean;
  manual_commands: string[];
  sudo_noninteractive: boolean;
  gui_auth_available: boolean;
};

type ApplyResult = {
  ok: boolean;
  error?: string;
  manual_commands?: string[];
};

interface UdevInstallGateProps {
  children: React.ReactNode;
}

export function UdevInstallGate({ children }: UdevInstallGateProps) {
  const [status, setStatus] = useState<RulesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [manualCommands, setManualCommands] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<RulesStatus>("/api/rules/status");
      setStatus(result);
      if (result.manual_commands) setManualCommands(result.manual_commands);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      const result = await apiPost<ApplyResult>("/api/rules/apply", {
        assignments: {},
        arm_assignments: {},
      });
      if (result.ok) {
        await checkStatus();
      } else {
        setInstallError(result.error ?? "Installation failed");
        if (result.manual_commands) setManualCommands(result.manual_commands);
      }
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : "Installation failed");
    } finally {
      setInstalling(false);
    }
  }, [checkStatus]);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(manualCommands.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [manualCommands]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Checking udev rules status…
      </div>
    );
  }

  if (status?.rules_installed) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center gap-6 py-16 px-4 max-w-lg mx-auto text-center">
      <div className="size-14 rounded-full bg-amber-500/10 flex items-center justify-center">
        <ShieldAlert size={28} className="text-amber-500" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          udev Rules Not Installed
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Device mapping requires udev rules to create stable symlinks for cameras and arms.
          Install the rules to continue.
        </p>
      </div>

      <button
        onClick={() => { void handleInstall(); }}
        disabled={installing}
        className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
      >
        {installing ? (
          <><Loader2 size={14} className="animate-spin" /> Installing…</>
        ) : (
          "Install Rules"
        )}
      </button>

      {installError && (
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-left">
            <AlertTriangle size={16} className="text-amber-500 flex-none mt-0.5" />
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-sm text-amber-700 dark:text-amber-400">
                Automatic installation failed. Run these commands in your terminal:
              </span>
            </div>
          </div>

          {manualCommands.length > 0 && (
            <div className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700">
                <span className="text-xs text-zinc-400">Terminal</span>
                <button
                  onClick={handleCopy}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <pre className="p-3 text-xs font-mono text-zinc-600 dark:text-zinc-300 overflow-x-auto text-left">
                {manualCommands.join("\n")}
              </pre>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => { void checkStatus(); }}
        disabled={loading}
        className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1.5 cursor-pointer"
      >
        <RefreshCw size={14} />
        Refresh Status
      </button>
    </div>
  );
}
