type TrainingReconnectedBannerProps = {
  visible: boolean;
};

export function TrainingReconnectedBanner({ visible }: TrainingReconnectedBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-info-line bg-info-bg text-sm text-info">
      <span className="flex-none">⚡</span>
      <span>Reconnected - This training session was recovered from a previous server session. Progress metrics may be unavailable. You can still stop the process.</span>
    </div>
  );
}
