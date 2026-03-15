import { describe, expect, it } from "vitest";

import type { LeStudioConfig } from "../store/types";
import {
  toBackendEvalPayload,
  toBackendRecordPayload,
  toBackendTeleopPayload,
  toBackendTrainPayload,
} from "./contracts";

describe("contracts payload builders", () => {
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
});
