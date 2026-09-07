import { describe, expect, it } from "vitest";

import { resetLeStudioState, setLeStudioState } from "../store";
import type { LeStudioConfig } from "../store/types";
import {
  toBackendEvalPayload,
  toBackendRecordPayload,
  toBackendTeleopPayload,
  toBackendTrainPayload,
} from "./contracts";

const CUSTOM_DEFAULTS = {
  version: 1,
  defaults: {
    single: { robot_type: "custom_single_follower", teleop_type: "custom_single_leader" },
    bi: { robot_type: "custom_bi_follower", teleop_type: "custom_bi_leader" },
  },
  types: {},
  lerobot_available: true,
} as const;

describe("contracts payload builders", () => {
  it("preserves explicit OMX single-arm types in teleop payloads", () => {
    const payload = toBackendTeleopPayload({
      modeLabel: "single",
      speedLabel: "1.0x",
      cameras: [],
      config: {
        robot_type: "omx_follower",
        teleop_type: "omx_leader",
        follower_port: "/dev/omx_follower",
        leader_port: "/dev/omx_leader",
        robot_id: "omx_follower",
        teleop_id: "omx_leader",
      },
    });

    expect(payload).toMatchObject({
      robot_mode: "single",
      robot_type: "omx_follower",
      teleop_type: "omx_leader",
      follower_port: "/dev/omx_follower",
      leader_port: "/dev/omx_leader",
      robot_id: "omx_follower",
      teleop_id: "omx_leader",
    });
  });

  it("uses policy catalog defaults when single-mode types are missing", () => {
    resetLeStudioState();
    setLeStudioState({ typeCatalog: CUSTOM_DEFAULTS, typeCatalogVersion: 1, typeCatalogLoaded: true });

    const payload = toBackendTeleopPayload({
      modeLabel: "single",
      speedLabel: "1.0x",
      cameras: [],
      config: {},
    });

    expect(payload).toMatchObject({
      robot_mode: "single",
      robot_type: "custom_single_follower",
      teleop_type: "custom_single_leader",
    });

    resetLeStudioState();
  });

  it("falls back to SO single-arm defaults when bi types leak into single mode", () => {
    const payload = toBackendTeleopPayload({
      modeLabel: "single",
      speedLabel: "0.5x",
      cameras: [],
      config: {
        robot_type: "bi_so_follower",
        teleop_type: "bi_so_leader",
      },
    });

    expect(payload).toMatchObject({
      robot_mode: "single",
      robot_type: "so101_follower",
      teleop_type: "so101_leader",
    });
  });

  it("builds teleop payload with normalized speed and mapped cameras", () => {
    const config: LeStudioConfig = { robot_type: "bi_so_follower", teleop_type: "bi_so_leader" };
    const payload = toBackendTeleopPayload({
      modeLabel: "Bimanual",
      speedLabel: "0.7x",
      cameras: [
        { role: "front", path: "/dev/video0" },
        { role: "wrist", path: "/dev/video2" },
      ],
      config,
    });

    expect(payload).toMatchObject({
      robot_mode: "bi",
      robot_type: "bi_so_follower",
      teleop_type: "bi_so_leader",
      teleop_speed: "0.7",
      cameras: { front: "/dev/video0", wrist: "/dev/video2" },
    });
  });

  it("builds record payload with minimum episode count and optional dataset root", () => {
    const payload = toBackendRecordPayload({
      modeLabel: "single",
      totalEpisodes: 0,
      repoId: "",
      task: "",
      resume: true,
      pushToHub: false,
      datasetRoot: "/tmp/datasets",
      cameras: [{ role: "top", path: "/dev/video0" }],
      config: { record_repo_id: "user/default", record_task: "pick" },
    });

    expect(payload).toMatchObject({
      record_repo_id: "user/default",
      record_episodes: 1,
      record_task: "pick",
      record_resume: true,
      record_push_to_hub: false,
      record_dataset_root: "/tmp/datasets",
    });
  });

  it("falls back to bimanual SO defaults when single-arm types are used in bi mode", () => {
    const payload = toBackendRecordPayload({
      modeLabel: "bimanual",
      totalEpisodes: 2,
      repoId: "user/bi-ds",
      task: "handover",
      resume: false,
      pushToHub: false,
      cameras: [],
      config: {
        robot_type: "so101_follower",
        teleop_type: "so101_leader",
      },
    });

    expect(payload).toMatchObject({
      robot_mode: "bi",
      robot_type: "bi_so_follower",
      teleop_type: "bi_so_leader",
    });
  });

  it("uses policy catalog defaults when bi-mode types are missing", () => {
    resetLeStudioState();
    setLeStudioState({ typeCatalog: CUSTOM_DEFAULTS, typeCatalogVersion: 1, typeCatalogLoaded: true });

    const payload = toBackendRecordPayload({
      modeLabel: "bimanual",
      totalEpisodes: 1,
      repoId: "user/bi-ds",
      task: "handover",
      resume: false,
      pushToHub: false,
      cameras: [],
      config: {},
    });

    expect(payload).toMatchObject({
      robot_mode: "bi",
      robot_type: "custom_bi_follower",
      teleop_type: "custom_bi_leader",
    });

    resetLeStudioState();
  });

  it("builds train payload using policy mapping and dataset source", () => {
    const payload = toBackendTrainPayload({
      policyLabel: "TD-MPC",
      datasetSource: "hf",
      localDatasetId: null,
      hfDatasetId: "org/repo",
      steps: 10.8,
      deviceLabel: "CPU",
      lr: " 1e-4 ",
      outputRepo: " output/repo ",
      batchSize: 0,
      config: { train_batch_size: 32 },
    });

    expect(payload).toMatchObject({
      train_policy: "tdmpc2",
      train_repo_id: "org/repo",
      train_steps: 10,
      train_device: "cpu",
      train_dataset_source: "hf",
      train_lr: "1e-4",
      train_output_repo: "output/repo",
      train_batch_size: 32,
    });
  });

  it("builds eval payload with role-based camera remapping", () => {
    const payload = toBackendEvalPayload({
      envType: "gym_pusht",
      policyPath: "outputs/train/act/checkpoints/last/pretrained_model",
      datasetRepo: "org/base",
      datasetOverride: " org/override ",
      episodes: 3,
      deviceLabel: "CUDA",
      task: "push",
      cameraMapping: { image_top: "front", image_wrist: "wrist", ignored: "missing" },
      cameraCatalog: [
        { role: "front", path: "/dev/video0" },
        { role: "wrist", path: "/dev/video1" },
      ],
      config: { robot_mode: "single" },
    });

    expect(payload).toMatchObject({
      eval_env_type: "gym_pusht",
      eval_repo_id: "org/override",
      eval_episodes: 3,
      eval_device: "cuda",
      cameras: {
        image_top: "/dev/video0",
        image_wrist: "/dev/video1",
      },
    });
  });

  it("preserves explicit OMX eval types while keeping single-arm payload normalization", () => {
    const payload = toBackendEvalPayload({
      envType: "gym_manipulator",
      policyPath: "outputs/train/act/checkpoints/last/pretrained_model",
      datasetRepo: "org/base",
      episodes: 1,
      deviceLabel: "CPU",
      task: "real_robot",
      cameraMapping: {},
      cameraCatalog: [],
      config: {
        robot_mode: "single",
        robot_type: "omx_follower",
        teleop_type: "omx_leader",
        eval_robot_type: "omx_follower",
        eval_teleop_type: "omx_leader",
      },
    });

    expect(payload).toMatchObject({
      robot_mode: "single",
      robot_type: "omx_follower",
      teleop_type: "omx_leader",
      eval_robot_type: "omx_follower",
      eval_teleop_type: "omx_leader",
    });
  });

  it("uses policy defaults for eval fallback types", () => {
    resetLeStudioState();
    setLeStudioState({ typeCatalog: CUSTOM_DEFAULTS, typeCatalogVersion: 1, typeCatalogLoaded: true });

    const payload = toBackendEvalPayload({
      envType: "gym_manipulator",
      policyPath: "outputs/train/act/checkpoints/last/pretrained_model",
      datasetRepo: "org/base",
      episodes: 1,
      deviceLabel: "CPU",
      task: "real_robot",
      cameraMapping: {},
      cameraCatalog: [],
      config: { robot_mode: "single" },
    });

    expect(payload).toMatchObject({
      robot_type: "custom_single_follower",
      teleop_type: "custom_single_leader",
      eval_robot_type: "custom_single_follower",
      eval_teleop_type: "custom_single_leader",
    });

    resetLeStudioState();
  });
});
