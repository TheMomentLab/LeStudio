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
          {import.meta.env.DEV && <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="hidden sm:inline">Demo:</span>
            <button onClick={onToggleNoPort} className={`px-2 py-0.5 rounded border cursor-pointer text-sm ${noPort ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"}`}>
              no port
            </button>
            <button onClick={onToggleConflict} className={`px-2 py-0.5 rounded border cursor-pointer text-sm ${hasConflict ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"}`}>
              conflict
            </button>
          </div>}
          <RefreshButton onClick={onRefresh} />
        </div>
      )}
    />
  );
}
