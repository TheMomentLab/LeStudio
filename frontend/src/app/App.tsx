import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { ThemeProvider } from "./theme-context";
import { Toaster } from "./components/ui/sonner";
import { requestDesktopNotificationPermission } from "./services/notifications";
import { runBootstrap, withPrefilledRepoIds } from "./services/bootstrap";
import { apiGet } from "./services/apiClient";
import { useLeStudioStore } from "./store";

export default function App() {
  const setConfig = useLeStudioStore((s) => s.setConfig);
  const setDevices = useLeStudioStore((s) => s.setDevices);
  const setSidebarSignals = useLeStudioStore((s) => s.setSidebarSignals);
  const setHfUsername = useLeStudioStore((s) => s.setHfUsername);
  const setProcStatus = useLeStudioStore((s) => s.setProcStatus);
  const setProcReconnected = useLeStudioStore((s) => s.setProcReconnected);
  const addToast = useLeStudioStore((s) => s.addToast);

  useEffect(() => {
    requestDesktopNotificationPermission();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const result = await runBootstrap();
      if (cancelled) return;

      setConfig(withPrefilledRepoIds(result.config, result.hfUsername));
      setDevices(result.devices);
      setSidebarSignals(result.sidebarSignals);
      setHfUsername(result.hfUsername);

      const processNames = ["teleop", "record", "calibrate", "motor_setup", "train", "train_install", "eval"] as const;
      const statuses = await Promise.all(
        processNames.map(async (name) => {
          try {
            const res = await apiGet<{ running?: boolean; reconnected?: boolean }>(`/api/process/${name}/status`);
            return [name, { running: Boolean(res.running), reconnected: Boolean(res.reconnected) }] as const;
          } catch {
            return [name, { running: false, reconnected: false }] as const;
          }
        }),
      );
      setProcStatus(Object.fromEntries(statuses.map(([n, s]) => [n, s.running])));
      setProcReconnected(Object.fromEntries(statuses.map(([n, s]) => [n, s.reconnected])));

      const errorKeys = Object.keys(result.errors);
      if (errorKeys.length > 0) {
        addToast(`Bootstrap degraded (${errorKeys.join(", ")})`, "info");
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [addToast, setConfig, setDevices, setHfUsername, setProcStatus, setProcReconnected, setSidebarSignals]);

  return (
    <ThemeProvider>
      <RouterProvider
        router={router}
        fallbackElement={(
          <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            Loading page...
          </div>
        )}
      />
      <Toaster position="top-right" closeButton richColors />
    </ThemeProvider>
  );
}
