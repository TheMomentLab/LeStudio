import { useEffect, useMemo, useState } from 'react'
import { MappedCameraRows } from '../components/shared/MappedCameraRows'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { RobotCapabilitiesCard } from '../components/shared/RobotCapabilitiesCard'
import { useConfig } from '../hooks/useConfig'
import { useMappedCameras } from '../hooks/useMappedCameras'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'
import type { LogLine, RobotDetail, RobotsResponse, TeleopsResponse } from '../lib/types'

interface TeleopTabProps {
  active: boolean
}

interface CalibrateListResponse {
  files: Array<{ id: string; guessed_type: string }>
}

interface CameraPathCheckResponse {
  [path: string]: boolean
}

interface TeleopFeedCamera {
  name: string
  path: string
}

const DEFAULT_FOLLOWER_PORTS = ['/dev/follower_arm_1', '/dev/follower_arm_2']
const DEFAULT_LEADER_PORTS = ['/dev/leader_arm_1', '/dev/leader_arm_2']
const EMPTY_TELEOP_LINES: LogLine[] = []
const TELEOP_LOOP_RE = /^Teleop loop time:\s*([0-9.]+)ms\s*\((\d+) Hz\)/

function buildSelectOptions(preferred: string[], values: string[], current: string): string[] {
  const seen = new Set<string>()
  const options: string[] = []
  ;[...preferred, ...values, current].forEach((value) => {
    const normalized = String(value ?? '').trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    options.push(normalized)
  })
  return options
}

export function TeleopTab({ active }: TeleopTabProps) {
  const { config, buildConfig } = useConfig()
  const { mappedCameras, refreshDevices } = useMappedCameras()
  const { runPreflight, stopProcess } = useProcess()
  const devices = useLeStudioStore((s) => s.devices)
  const addToast = useLeStudioStore((s) => s.addToast)
  const running = useLeStudioStore((s) => !!s.procStatus.teleop)
  const clearLog = useLeStudioStore((s) => s.clearLog)
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const teleopLines = useLeStudioStore((s) => s.logLines.teleop ?? EMPTY_TELEOP_LINES)
  const setActiveTab = useLeStudioStore((s) => s.setActiveTab)

  const [mode, setMode] = useState<'single' | 'bi'>('single')
  const [robotTypes, setRobotTypes] = useState<string[]>(['so101_follower'])
  const [teleopTypes, setTeleopTypes] = useState<string[]>(['so101_leader'])
  const [robotDetails, setRobotDetails] = useState<Record<string, RobotDetail>>({})
  const [followerIds, setFollowerIds] = useState<string[]>(['my_so101_follower_1'])
  const [leaderIds, setLeaderIds] = useState<string[]>(['my_so101_leader_1'])
  const [availableCameras, setAvailableCameras] = useState<TeleopFeedCamera[]>([])
  const [streamCodec, setStreamCodec] = useState<'MJPG' | 'YUYV'>('MJPG')
  const [streamResolution, setStreamResolution] = useState('640x480')
  const [streamFps, setStreamFps] = useState('30')
  const [jpegQuality, setJpegQuality] = useState(70)
  const [pausedFeeds, setPausedFeeds] = useState<Record<string, boolean>>({})

  const loopPerf = (() => {
    for (let i = teleopLines.length - 1; i >= 0; i -= 1) {
      const line = teleopLines[i]?.text ?? ''
      const match = line.match(TELEOP_LOOP_RE)
      if (!match) continue
      const ms = Number(match[1])
      const hz = Number(match[2])
      if (Number.isFinite(ms) && Number.isFinite(hz)) {
        return { ms, hz }
      }
    }
    return null
  })()

  useEffect(() => {
    if (!active) return
    refreshDevices()
    apiGet<RobotsResponse>('/api/robots').then((r) => {
      setRobotTypes(r.types ?? ['so101_follower'])
      setRobotDetails(r.details ?? {})
    })
    const currentRobotType = (config.robot_type as string) || 'so101_follower'
    apiGet<TeleopsResponse>(`/api/teleops?robot_type=${encodeURIComponent(currentRobotType)}`).then((r) => setTeleopTypes(r.types ?? ['so101_leader']))
    apiGet<CalibrateListResponse>('/api/calibrate/list')
      .then((r) => {
        const files = r.files ?? []
        const nextFollowerIds = [...new Set(files.filter((f) => String(f.guessed_type ?? '').includes('follower')).map((f) => f.id))].sort()
        const nextLeaderIds = [...new Set(files.filter((f) => String(f.guessed_type ?? '').includes('leader')).map((f) => f.id))].sort()
        setFollowerIds(nextFollowerIds.length ? nextFollowerIds : ['my_so101_follower_1'])
        setLeaderIds(nextLeaderIds.length ? nextLeaderIds : ['my_so101_leader_1'])
      })
      .catch(() => {
        setFollowerIds(['my_so101_follower_1'])
        setLeaderIds(['my_so101_leader_1'])
      })
  }, [active, refreshDevices])

  useEffect(() => {
    const robotMode = (config.robot_mode as string) ?? 'single'
    setMode(robotMode === 'bi' ? 'bi' : 'single')
  }, [config.robot_mode])

  const selectedRobotType = (config.robot_type as string) ?? robotTypes[0] ?? 'so101_follower'

  useEffect(() => {
    if (!active) return
    apiGet<TeleopsResponse>(`/api/teleops?robot_type=${encodeURIComponent(selectedRobotType)}`)
      .then((r) => {
        const types = r.types ?? ['so101_leader']
        setTeleopTypes(types)
        const currentTeleop = (config.teleop_type as string) ?? ''
        if (currentTeleop && !types.includes(currentTeleop) && types.length > 0) {
          buildConfig({ teleop_type: types[0] })
        }
      })
      .catch(() => setTeleopTypes(['so101_leader']))
  }, [active, selectedRobotType])

  const selectedRobotDetail = robotDetails[selectedRobotType] ?? null

  const armPaths = useMemo(() => {
    const all = new Set<string>()
    devices.arms.forEach((arm) => {
      if (arm.symlink) all.add(`/dev/${arm.symlink}`)
      if (arm.path) all.add(arm.path)
    })
    return [...all]
  }, [devices])

  const followerPort = (config.follower_port as string) ?? '/dev/follower_arm_1'
  const leaderPort = (config.leader_port as string) ?? '/dev/leader_arm_1'
  const leftFollowerPort = (config.left_follower_port as string) ?? '/dev/follower_arm_1'
  const rightFollowerPort = (config.right_follower_port as string) ?? '/dev/follower_arm_2'
  const leftLeaderPort = (config.left_leader_port as string) ?? '/dev/leader_arm_1'
  const rightLeaderPort = (config.right_leader_port as string) ?? '/dev/leader_arm_2'
  const robotId = (config.robot_id as string) ?? 'my_so101_follower_1'
  const teleopId = (config.teleop_id as string) ?? 'my_so101_leader_1'

  const followerPortOptions = useMemo(
    () => buildSelectOptions(DEFAULT_FOLLOWER_PORTS, armPaths, followerPort),
    [armPaths, followerPort],
  )
  const leaderPortOptions = useMemo(
    () => buildSelectOptions(DEFAULT_LEADER_PORTS, armPaths, leaderPort),
    [armPaths, leaderPort],
  )
  const leftFollowerPortOptions = useMemo(
    () => buildSelectOptions(DEFAULT_FOLLOWER_PORTS, armPaths, leftFollowerPort),
    [armPaths, leftFollowerPort],
  )
  const rightFollowerPortOptions = useMemo(
    () => buildSelectOptions(['/dev/follower_arm_2', '/dev/follower_arm_1'], armPaths, rightFollowerPort),
    [armPaths, rightFollowerPort],
  )
  const leftLeaderPortOptions = useMemo(
    () => buildSelectOptions(DEFAULT_LEADER_PORTS, armPaths, leftLeaderPort),
    [armPaths, leftLeaderPort],
  )
  const rightLeaderPortOptions = useMemo(
    () => buildSelectOptions(['/dev/leader_arm_2', '/dev/leader_arm_1'], armPaths, rightLeaderPort),
    [armPaths, rightLeaderPort],
  )
  const followerIdOptions = useMemo(() => buildSelectOptions(['my_so101_follower_1'], followerIds, robotId), [followerIds, robotId])
  const leaderIdOptions = useMemo(() => buildSelectOptions(['my_so101_leader_1'], leaderIds, teleopId), [leaderIds, teleopId])

  useEffect(() => {
    if (!active) return
    const cameras = Object.entries(mappedCameras)
      .map(([name, path]) => ({ name, path }))
      .filter((camera) => camera.path)
    if (!cameras.length) {
      setAvailableCameras([])
      return
    }
    const checkPaths = async () => {
      try {
        const paths = cameras.map((camera) => camera.path)
        const exists = await apiPost<CameraPathCheckResponse>('/api/camera/check_paths', { paths })
        setAvailableCameras(cameras.filter((camera) => exists[camera.path]))
      } catch {
        setAvailableCameras(cameras)
      }
    }
    checkPaths()
  }, [active, mappedCameras])

  useEffect(() => {
    if (active) return
    setPausedFeeds({})
  }, [active])

  useEffect(() => {
    setPausedFeeds((prev) => {
      const next: Record<string, boolean> = {}
      availableCameras.forEach((camera) => {
        if (prev[camera.path]) next[camera.path] = true
      })
      return next
    })
  }, [availableCameras])

  const feedResolution = useMemo(() => {
    const [width, height] = streamResolution.split('x')
    return {
      width: width || '640',
      height: height || '480',
    }
  }, [streamResolution])

  const streamSrc = (cameraPath: string) => {
    const cameraName = cameraPath.replace('/dev/', '')
    return `/stream/${encodeURIComponent(cameraName)}?codec=${streamCodec}&width=${feedResolution.width}&height=${feedResolution.height}&fps=${streamFps}&quality=${jpegQuality}`
  }

  const getCfg = () => {
    const cfg: Record<string, unknown> = {
      robot_mode: mode,
      robot_type: (config.robot_type as string) ?? robotTypes[0] ?? 'so101_follower',
      teleop_type: (config.teleop_type as string) ?? teleopTypes[0] ?? 'so101_leader',
      follower_port: (config.follower_port as string) ?? '/dev/follower_arm_1',
      robot_id: (config.robot_id as string) ?? 'my_so101_follower_1',
      leader_port: (config.leader_port as string) ?? '/dev/leader_arm_1',
      teleop_id: (config.teleop_id as string) ?? 'my_so101_leader_1',
      left_follower_port: (config.left_follower_port as string) ?? '/dev/follower_arm_1',
      right_follower_port: (config.right_follower_port as string) ?? '/dev/follower_arm_2',
      left_leader_port: (config.left_leader_port as string) ?? '/dev/leader_arm_1',
      right_leader_port: (config.right_leader_port as string) ?? '/dev/leader_arm_2',
      teleop_speed: (config.teleop_speed as string) ?? '0.5',
      cameras: mappedCameras,
    }
    return cfg
  }

  const start = async () => {
    clearLog('teleop')
    const cfg = getCfg()
    await buildConfig(cfg)
    const ok = await runPreflight(cfg, 'teleop')
    if (!ok) return
    const res = await apiPost<{ ok: boolean; error?: string }>('/api/teleop/start', cfg)
    if (!res.ok) {
      appendLog('teleop', `[ERROR] ${res.error ?? 'failed to start'}`, 'error')
      return
    }
    addToast('Teleop started', 'success')
  }

  const stop = async () => {
    await stopProcess('teleop')
    addToast('Teleop stop requested', 'info')
  }

  const update = (key: string, value: string) => {
    buildConfig({ [key]: value })
  }

  const setModeAndConfig = (nextMode: 'single' | 'bi') => {
    setMode(nextMode)
    update('robot_mode', nextMode)
  }

  return (
    <section id="tab-teleop" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Teleoperation</h2>
        <div className="mode-toggle">
          <label>Control Mode:</label>
          <button id="teleop-mode-single" className={`toggle ${mode === 'single' ? 'active' : ''}`} onClick={() => setModeAndConfig('single')}>
            Single Arm
          </button>
          <button id="teleop-mode-bi" className={`toggle ${mode === 'bi' ? 'active' : ''}`} onClick={() => setModeAndConfig('bi')}>
            Bi-Arm
          </button>
          <span
            id="teleop-loop-pill"
            className={`perf-pill ${!loopPerf ? 'idle' : loopPerf.hz >= 58 ? 'good' : loopPerf.hz >= 54 ? 'warn' : 'bad'}`}
            title={loopPerf ? `Loop latency: ${loopPerf.ms.toFixed(2)}ms · ${loopPerf.hz}Hz (Good: ≥58Hz, Warn: 54–57Hz, Bad: <54Hz)` : 'Teleop loop latency — starts once teleop is running'}
          >
            {loopPerf ? `Loop: ${loopPerf.ms.toFixed(2)}ms (${loopPerf.hz}Hz)` : 'Loop: --'}
          </span>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Step 1 — Arm Connections</h3>
          <div className="field-help">Single Arm controls one leader + one follower. Bi-Arm controls left/right pairs.</div>
          <div className="teleop-arm-grid">
            <div className="form-field">
              <label>Robot Type</label>
              <select value={(config.robot_type as string) ?? robotTypes[0] ?? ''} onChange={(e) => update('robot_type', e.target.value)}>
                {robotTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Teleoperator Type</label>
              <select value={(config.teleop_type as string) ?? teleopTypes[0] ?? ''} onChange={(e) => update('teleop_type', e.target.value)}>
                {teleopTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field-full">
              <RobotCapabilitiesCard
                capabilities={selectedRobotDetail?.capabilities ?? null}
                compatibleTeleops={selectedRobotDetail?.compatible_teleops ?? []}
              />
            </div>
            {mode === 'single' ? (
              <>
                <div className="form-field">
                  <label>Follower Arm Port</label>
                  <select value={followerPort} onChange={(e) => update('follower_port', e.target.value)}>
                    {followerPortOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Follower Arm ID</label>
                  <select value={robotId} onChange={(e) => update('robot_id', e.target.value)}>
                    {followerIdOptions.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Leader Arm Port</label>
                  <select value={leaderPort} onChange={(e) => update('leader_port', e.target.value)}>
                    {leaderPortOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Leader Arm ID</label>
                  <select value={teleopId} onChange={(e) => update('teleop_id', e.target.value)}>
                    {leaderIdOptions.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="form-field">
                  <label>Left Follower Arm Port</label>
                  <select value={leftFollowerPort} onChange={(e) => update('left_follower_port', e.target.value)}>
                    {leftFollowerPortOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Right Follower Arm Port</label>
                  <select value={rightFollowerPort} onChange={(e) => update('right_follower_port', e.target.value)}>
                    {rightFollowerPortOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Left Leader Arm Port</label>
                  <select value={leftLeaderPort} onChange={(e) => update('left_leader_port', e.target.value)}>
                    {leftLeaderPortOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Right Leader Arm Port</label>
                  <select value={rightLeaderPort} onChange={(e) => update('right_leader_port', e.target.value)}>
                    {rightLeaderPortOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Step 2 — Camera Feeds</h3>
          {Object.keys(mappedCameras).length === 0 && (
            <div className="field-help">
              No cameras mapped yet.{' '}
              <button type="button" className="link-btn" onClick={() => setActiveTab('device-setup')}>→ Go to Mapping</button>
            </div>
          )}
          <div id="teleop-cameras" className="camera-cfg" style={{ marginTop: 16 }}>
            <MappedCameraRows mappedCameras={mappedCameras} />
          </div>
          <details className="advanced-panel" style={{ marginTop: 12 }}>
            <summary>Advanced Stream Settings</summary>
            <div className="settings-grid" style={{ marginTop: 10 }}>
              <div className="setting-item">
                <label>Codec</label>
                <select className="cam-codec-sync" value={streamCodec} onChange={(e) => setStreamCodec(e.target.value as 'MJPG' | 'YUYV')}>
                  <option value="MJPG">MJPG (compressed)</option>
                  <option value="YUYV">YUYV (raw)</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Resolution</label>
                <select className="cam-resolution-sync" value={streamResolution} onChange={(e) => setStreamResolution(e.target.value)}>
                  <option value="1280x720">1280 × 720 (720p)</option>
                  <option value="800x600">800 × 600</option>
                  <option value="640x480">640 × 480 (480p)</option>
                  <option value="320x240">320 × 240 (240p)</option>
                </select>
              </div>
              <div className="setting-item">
                <label>FPS</label>
                <select className="cam-fps-sync" value={streamFps} onChange={(e) => setStreamFps(e.target.value)}>
                  <option value="30">30</option>
                </select>
              </div>
              <div className="setting-item">
                <label>
                  JPEG Quality <span className="cam-quality-val-sync muted">{jpegQuality}%</span>
                </label>
                <input
                  type="range"
                  className="cam-jpeg-quality-sync"
                  min={30}
                  max={95}
                  step={5}
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(Number(e.target.value))}
                />
              </div>
            </div>
          </details>
        </div>

        <div className="episode-progress-card">
          <div className="ep-card-title">Teleop Control</div>
          <div id="teleop-feeds" className="feed-grid">
            {active && availableCameras.length ? (
              availableCameras.map((camera) => (
                <div className="feed-card" key={camera.name} data-vid={camera.path.replace('/dev/', '')}>
                  <img src={pausedFeeds[camera.path] ? undefined : streamSrc(camera.path)} alt={camera.name} />
                  <div className={`feed-live-badge ${pausedFeeds[camera.path] ? '' : 'visible'}`}>
                    <div className="feed-live-dot" />LIVE
                  </div>
                  <div className={`feed-fps-badge ${pausedFeeds[camera.path] ? '' : 'visible'}`}>{streamFps} fps</div>
                  <button className="feed-close-btn" title="Pause this feed" onClick={() => setPausedFeeds((prev) => ({ ...prev, [camera.path]: true }))}>×</button>
                  {pausedFeeds[camera.path] ? (
                    <div className="feed-paused-ov">
                      <span style={{ fontSize: 20, opacity: 0.4 }}>⏸</span>
                      <span className="feed-paused-text">{camera.name} — paused</span>
                      <button className="btn-xs feed-overlay-btn" onClick={() => setPausedFeeds((prev) => ({ ...prev, [camera.path]: false }))}>
                        ▶ Resume
                      </button>
                    </div>
                  ) : null}
                  <div className="feed-label">
                    <span>
                      {camera.name} — {camera.path}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-cameras-empty">
                <div className="no-cam-text">
                  No cameras detected.
                  <br />
                  Connect a camera and refresh.
                </div>
              </div>
            )}
          </div>
          <div className="ep-actions-panel">
            <div
              className="safety-banner"
              style={{
                background: 'rgba(248,81,73,0.08)',
                border: '1px solid rgba(248,81,73,0.25)',
                borderRadius: 4,
                padding: '6px 10px',
                marginBottom: 8,
                fontSize: 11,
                color: 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
              }}
            >
              <span style={{ fontSize: 13 }}>⚠️</span>
              <span>
                Unexpected movement → press <b>Stop</b> immediately. Keep hands clear.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: 'var(--text2)', minWidth: 48 }}>Speed:</label>
              <select value={(config.teleop_speed as string) ?? '0.5'} onChange={(e) => update('teleop_speed', e.target.value)}>
                <option value="0.1">0.1x (slow)</option>
                <option value="0.25">0.25x</option>
                <option value="0.5">0.5x (default)</option>
                <option value="0.75">0.75x</option>
                <option value="1.0">1.0x (full)</option>
              </select>
            </div>
            <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Teleop" />
          </div>
        </div>
      </div>
    </section>
  )
}
