import { BlockerCard } from "../../../components/wireframe";

type EvaluationConfigBlockersProps = {
  show: boolean;
  isRunning: boolean;
  reasons: string[];
};

export function EvaluationConfigBlockers({ show, isRunning, reasons }: EvaluationConfigBlockersProps) {
  if (!show || isRunning || reasons.length === 0) {
    return null;
  }

  return (
    <>
      {reasons.map((reason, index) => (
        <BlockerCard
          key={`${reason}-${index}`}
          severity="warning"
          reasons={[
            reason,
            ...(reason === "No checkpoint selected" ? [{ text: "Go to Train", to: "/train" }] : []),
          ]}
        />
      ))}
    </>
  );
}
