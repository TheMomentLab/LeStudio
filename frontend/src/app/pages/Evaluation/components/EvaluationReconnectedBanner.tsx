type EvaluationReconnectedBannerProps = {
  visible: boolean;
};

export function EvaluationReconnectedBanner({ visible }: EvaluationReconnectedBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/5 text-sm text-blue-600 dark:text-blue-400">
      <span className="flex-none">⚡</span>
      <span>Reconnected - This evaluation was recovered from a previous server session. Progress metrics may be unavailable. You can still stop the process.</span>
    </div>
  );
}
