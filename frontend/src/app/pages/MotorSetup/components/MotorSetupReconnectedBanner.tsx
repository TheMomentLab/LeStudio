type MotorSetupReconnectedBannerProps = {
  setupRunning: boolean;
  setupReconnected: boolean;
  calibrateRunning: boolean;
  calibrateReconnected: boolean;
};

export function MotorSetupReconnectedBanner({
  setupRunning,
  setupReconnected,
  calibrateRunning,
  calibrateReconnected,
}: MotorSetupReconnectedBannerProps) {
  if (!((setupRunning && setupReconnected) || (calibrateRunning && calibrateReconnected))) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-info-line bg-info-bg text-sm text-info">
      <span className="flex-none">⚡</span>
      <span>Reconnected - This {setupRunning && setupReconnected ? "motor setup" : "calibration"} process was recovered from a previous server session. You can still stop it.</span>
    </div>
  );
}
