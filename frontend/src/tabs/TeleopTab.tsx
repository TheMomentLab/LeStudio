import { useEffect, useMemo, useState } from 'react'
import { MappedCameraRows } from '../components/shared/MappedCameraRows'
import { LogConsole } from '../components/shared/LogConsole'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useConfig } from '../hooks/useConfig'
import { useMappedCameras } from '../hooks/useMappedCameras'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'

interface TeleopTabProps {
  active: boolean
}

export function TeleopTab({ active }: TeleopTabProps) {
  const { config, buildConfig } = useConfig()
  const { mappedCameras, refreshDevices } = useMappedCameras()
  const { runPreflight, stopProcess } = useProcess()
  const addToast = useLeStudioStore((s) => s.addToast)
  const running = useLeStudioStore((s) => !!s.procStatus.teleop)
  const clearLog = useLeStudioStore((s) => s.clearLog)
  const appendLog = useLeStudioStore((s) => s.appendLog)

  const [mode, setMode] = useState<'single' | 'bi'>('single')
  const [robotTypes, setRobotTypes] = useState<string[]>(['so101_follower'])
  const [teleopTypes, setTeleopTypes] = useState<string[]>(['so101_leader'])

  useEffect(() => {
    if (!active) return
    refreshDevices()
    apiGet<{ types: string[] }>('/api/robots').then((r) => setRobotTypes(r.types ?? ['so101_follower']))
    apiGet<{ types: string[] }>('/api/teleops').then((r) => setTeleopTypes(r.types ?? ['so101_leader']))
    apiGet<{ files: Array<{ id: string; guessed_type: string }> }>('/api/calibrate/list').catch(() => undefined)
  }, [active, refreshDevices])

  useEffect(() => {
    const robotMode = (config.robot_mode as string) ?? 'single'
    setMode(robotMode === 'bi' ? 'bi' : 'single')
  }, [config.robot_mode])

  const armPaths = useMemo(() => {
    const devices = useLeStudioStore.getState().devices
    const all = new Set<string>()
    devices.arms.forEach((arm) => {
      if (arm.symlink) all.add(`/dev/${arm.symlink}`)
      if (arm.path) all.add(arm.path)
    })
    return [...all]
  }, [useLeStudioStore((s) => s.devices)])

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

  return (
    <section id="tab-teleop" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Teleoperation</h2>
        <div className="mode-toggle">
          <label>Control Mode:</label>
          <button id="teleop-mode-single" className={`toggle ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
            Single Arm
          </button>
          <button id="teleop-mode-bi" className={`toggle ${mode === 'bi' ? 'active' : ''}`} onClick={() => setMode('bi')}>
            Bi-Arm
          </button>
          <span id="teleop-loop-pill" className="perf-pill idle">
            Loop: --
          </span>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Step 1 — Arm Connections</h3>
          <label>Robot Type</label>
          <select value={(config.robot_type as string) ?? robotTypes[0] ?? ''} onChange={(e) => update('robot_type', e.target.value)}>
            {robotTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label>Teleoperator Type</label>
          <select value={(config.teleop_type as string) ?? teleopTypes[0] ?? ''} onChange={(e) => update('teleop_type', e.target.value)}>
            {teleopTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {mode === 'single' ? (
            <>
              <label>Follower Arm Port</label>
              <select value={(config.follower_port as string) ?? '/dev/follower_arm_1'} onChange={(e) => update('follower_port', e.target.value)}>
                {armPaths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <label>Follower Arm ID</label>
              <input value={(config.robot_id as string) ?? 'my_so101_follower_1'} onChange={(e) => update('robot_id', e.target.value)} />
              <label>Leader Arm Port</label>
              <select value={(config.leader_port as string) ?? '/dev/leader_arm_1'} onChange={(e) => update('leader_port', e.target.value)}>
                {armPaths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <label>Leader Arm ID</label>
              <input value={(config.teleop_id as string) ?? 'my_so101_leader_1'} onChange={(e) => update('teleop_id', e.target.value)} />
            </>
          ) : (
            <>
              <label>Left Follower Arm Port</label>
              <input value={(config.left_follower_port as string) ?? '/dev/follower_arm_1'} onChange={(e) => update('left_follower_port', e.target.value)} />
              <label>Right Follower Arm Port</label>
              <input value={(config.right_follower_port as string) ?? '/dev/follower_arm_2'} onChange={(e) => update('right_follower_port', e.target.value)} />
              <label>Left Leader Arm Port</label>
              <input value={(config.left_leader_port as string) ?? '/dev/leader_arm_1'} onChange={(e) => update('left_leader_port', e.target.value)} />
              <label>Right Leader Arm Port</label>
              <input value={(config.right_leader_port as string) ?? '/dev/leader_arm_2'} onChange={(e) => update('right_leader_port', e.target.value)} />
            </>
          )}
        </div>

        <div className="card">
          <h3>Step 2 — Camera Feeds</h3>
          <MappedCameraRows mappedCameras={mappedCameras} />
        </div>

        <div className="episode-progress-card">
          <div className="ep-card-title">Teleop Control</div>
          <div className="ep-actions-panel">
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
          <div className="terminal-card" style={{ marginTop: 10 }}>
            <LogConsole processName="teleop" />
          </div>
        </div>
      </div>
    </section>
  )
}
