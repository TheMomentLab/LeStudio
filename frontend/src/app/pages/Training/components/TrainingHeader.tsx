import { PageHeader, RefreshButton } from "../../../components/wireframe";

type TrainingHeaderProps = {
  onRefreshCheckpoints: () => void;
};

export function TrainingHeader({ onRefreshCheckpoints }: TrainingHeaderProps) {
  return (
    <PageHeader
      title="AI Training"
      subtitle="Train AI policies on recorded datasets and monitor progress in real-time"
      action={<RefreshButton onClick={onRefreshCheckpoints} />}
    />
  );
}
