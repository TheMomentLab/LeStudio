import { PageHeader, RefreshButton } from "../../../components/wireframe";

type MotorSetupHeaderProps = {
  noPort: boolean;
  hasConflict: boolean;
  onToggleNoPort: () => void;
  onToggleConflict: () => void;
  onRefresh: () => void;
};

export function MotorSetupHeader({
  noPort,
  hasConflict,
  onToggleNoPort,
  onToggleConflict,
  onRefresh,
}: MotorSetupHeaderProps) {
  return (
    <PageHeader
      title="Motor Setup"
      subtitle="Arm mapping, motor ID setup and verification"
      action={(
        <div className="flex items-center gap-2">
          {import.meta.env.DEV && <div className="flex items-center gap-2 text-sm text-fg-muted">
            <span className="hidden sm:inline">Demo:</span>
            <button onClick={onToggleNoPort} className={`px-2 py-0.5 rounded border cursor-pointer text-sm ${noPort ? "border-warn-line text-warn bg-warn-bg" : "border-line-control text-fg-muted"}`}>
              no port
            </button>
            <button onClick={onToggleConflict} className={`px-2 py-0.5 rounded border cursor-pointer text-sm ${hasConflict ? "border-danger-line text-danger bg-danger-bg" : "border-line-control text-fg-mu00"}`}>
              conflict
            </button>
          </div>}
          <RefreshButton onClick={onRefresh} />
        </div>
      )}
    />
  );
}
