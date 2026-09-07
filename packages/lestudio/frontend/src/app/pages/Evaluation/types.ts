import type { LogLine } from "../../store/types";
import type { EpisodeResult } from "../../hooks/useEvalProgress";

export const EMPTY_LOG: LogLine[] = [];

export type EvalPreflightResponse = {
  ok: boolean;
  reason?: string;
  action?: string;
  command?: string;
};

export type CalibrationFileStatusResponse = {
  exists: boolean;
  path: string;
  modified?: string;
  size?: number;
};

export type EvalCalibrationProfile = {
  configKey: string;
  label: string;
  deviceType: string;
  deviceId: string;
  exists: boolean | null;
  path: string;
  modified?: string;
};

export type RewardTooltipEntry = {
  payload?: EpisodeResult;
};
