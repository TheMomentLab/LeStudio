# API and Streaming

LeStudio separates control APIs, live runtime events, and camera transport.

Use this page when you want to understand how the browser talks to the backend during normal operation.

## Transport split

### REST

REST handles:

- config load/save
- device and ecosystem queries
- preflight checks
- process start/stop/input
- training and eval launch
- dataset and Hugging Face Hub workflows
- motor monitoring commands

Representative endpoints:

- `GET /api/config`
- `GET /api/devices`
- `POST /api/preflight`
- `POST /api/teleop/start`
- `POST /api/record/start`
- `POST /api/train/start`
- `POST /api/eval/start`

### WebSocket

`/ws` is the shared runtime event channel.

It sends:

- `output` events for process console lines
- `metric` events for parsed train metrics
- `status` snapshots for managed processes

The frontend keeps one shared socket and routes these events into train and non-train listeners.

### Camera HTTP endpoints

Camera frames do not go through `/ws`.

LeStudio uses:

- `/stream/{video_name}` for MJPEG
- `/api/camera/snapshot/{video_name}` for single-frame polling
- `/api/camera/stats` for FPS and bandwidth

## Why camera transport is separate

During teleop and record, LeRobot-side processes own the camera devices. LeStudio keeps previews alive by reading JPEG frames from shared memory written by the camera patch layer, instead of trying to multiplex camera frames over the console WebSocket.

## Frontend transport layer

`frontend/src/app/services/apiClient.ts` is responsible for:

- real backend passthrough mode
- mock mode for UI development
- shared WebSocket connection management
- backend event normalization
- fallback log appending into the global store

## Process output behavior

`ProcessManager` does more than forward raw text.

It also:

- extracts training metrics from logs
- translates common errors into guidance messages
- emits replace-tags for live progress lines and table redraws
- persists process state so the server can reconnect after restart

## Related Guides

- [Architecture](architecture.md) for the broader system view
- [Workflow](workflow.md) for the user-facing execution sequence
- [Troubleshooting](troubleshooting.md) for common failures around permissions, processes, CUDA, and eval

## More detail

- See [Architecture](architecture.md) for the broader system view.
- Internal implementation notes live in `docs/api-and-streaming.md`.
