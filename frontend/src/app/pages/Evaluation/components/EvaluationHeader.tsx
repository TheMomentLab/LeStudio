import { PageHeader, RefreshButton } from "../../../components/wireframe";

type EvaluationHeaderProps = {
  onRefresh: () => void;
};

export function EvaluationHeader({ onRefresh }: EvaluationHeaderProps) {
  return (
    <PageHeader
      title="Policy Evaluation"
      subtitle="Evaluate trained AI policies on real robots or simulated environments"
      action={<RefreshButton onClick={onRefresh} />}
    />
  );
}
