import type { ResolvedArmConfig } from "../../services/armSets";

export function getResolvedConfigSignature(config: ResolvedArmConfig): string {
  return [
    config.robotType,
    config.teleopType,
    config.followerPort,
    config.leaderPort,
    config.followerId,
    config.leaderId,
    config.leftFollowerPort,
    config.rightFollowerPort,
    config.leftLeaderPort,
    config.rightLeaderPort,
    config.leftRobotId,
    config.rightRobotId,
    config.leftTeleopId,
    config.rightTeleopId,
  ].join("|");
}

export function shouldPublishResolvedConfig(
  previousSignature: string | null,
  config: ResolvedArmConfig,
): boolean {
  return getResolvedConfigSignature(config) !== previousSignature;
}
