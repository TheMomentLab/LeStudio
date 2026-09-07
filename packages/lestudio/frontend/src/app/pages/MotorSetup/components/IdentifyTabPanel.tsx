import { Bot, Zap } from "lucide-react";
import { buttonStyles } from "../../../components/ui/button";
import { Card, EmptyState, StatusBadge, WireSelect } from "../../../components/wireframe";
import { symToDisplayLabel } from "../../../services/portLabels";
import type { ArmDevice } from "../types";

interface IdentifyTabPanelProps {
  arms: ArmDevice[];
  identifyStep: "idle" | "waiting" | "found" | "conflict";
  identifyRole: string;
  armRoles: string[];
  onSetIdentifyStep: (step: "idle" | "waiting" | "found" | "conflict") => void;
  onSetIdentifyRole: (role: string) => void;
}

export function IdentifyTabPanel({
  arms,
  identifyStep,
  identifyRole,
  armRoles,
  onSetIdentifyStep,
  onSetIdentifyRole,
}: IdentifyTabPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {arms.length === 0 ? (
        <Card title={`Connected Arms (${arms.length})`}>
          <EmptyState
            icon={<Zap size={28} />}
            message="No arms detected. Connect USB and refresh."
            messageClassName="max-w-none whitespace-nowrap"
          />
        </Card>
      ) : (
        <Card title={`Connected Arms (${arms.length})`} bodyClassName="p-0">
          <div className="px-4">
            <div className="flex flex-col divide-y divide-line-subtle border-b border-line-subtle">
              {arms.map((arm) => (
                <div key={arm.device} className="flex items-center gap-3 py-2.5">
                  <div className="size-7 rounded bg-surface-sunken flex items-center justify-center">
                    <Bot size={14} className="text-fg-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-fg-body font-mono truncate">{arm.path}</div>
                    {arm.serial && <div className="text-sm text-fg-muted">S/N: {arm.serial}</div>}
                  </div>
                  <StatusBadge status={arm.symlink ? "ready" : "warning"} label={arm.symlink ? symToDisplayLabel(arm.symlink) : "no symlink"} />
                </div>
              ))}
            </div>
          </div>

          {identifyStep === "idle" && (
            <div className="px-4 py-3 border-t border-line-subtle flex items-center gap-3">
              <span className="text-sm text-fg-muted">Disconnect one arm from USB, then click Start.</span>
              <button
                onClick={() => onSetIdentifyStep("waiting")}
                className={buttonStyles({
                  variant: "primary",
                  tone: "success",
                  className: "ml-auto h-10 px-5 whitespace-nowrap",
                })}
              >
                <Zap size={12} className="inline mr-1.5" />
                Start Identify
              </button>
            </div>
          )}
        </Card>
      )}

      {identifyStep === "waiting" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded border border-warn-line bg-warn-bg">
            <span className="size-2 rounded-full bg-warn-solid animate-pulse" />
            <span className="text-sm text-warn">Reconnect the arm... Detecting changes (1.5s polling)</span>
          </div>
          <div className="flex items-center gap-3">
            {import.meta.env.DEV && <button onClick={() => onSetIdentifyStep("found")} className="text-sm text-fg-muted hover:text-fg-body cursor-pointer underline w-fit">
              (Demo: detected)
            </button>}
            <button onClick={() => onSetIdentifyStep("idle")} className="text-sm text-danger hover:text-danger/80 cursor-pointer w-fit">
              Cancel
            </button>
          </div>
        </div>
      )}

      {identifyStep === "found" && (
        <div className="flex flex-col gap-3">
          <div className="px-3 py-2.5 rounded border border-ok-line bg-ok-bg">
            <p className="text-sm text-ok mb-1.5">✓ Arm detected. Assign a role below.</p>
          </div>
          <div className="flex items-center gap-2">
            <WireSelect value={identifyRole} options={armRoles} onChange={onSetIdentifyRole} />
            <button
              onClick={() => { onSetIdentifyStep("idle"); onSetIdentifyRole("(none)"); }}
              disabled={identifyRole === "(none)"}
              className={buttonStyles({
                variant: "primary",
                tone: "success",
                className: "h-auto px-4 py-2",
              })}
            >
              Assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
