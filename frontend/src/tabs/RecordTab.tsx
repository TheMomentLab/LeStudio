import { useEffect, useMemo, useState } from 'react'
import { MappedCameraRows } from '../components/shared/MappedCameraRows'
import { LogConsole } from '../components/shared/LogConsole'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useConfig } from '../hooks/useConfig'
import { useMappedCameras } from '../hooks/useMappedCameras'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'
import type { LogLine } from '../lib/types'

interface RecordTabProps {
  active: boolean
}

export function RecordTab({ active }: RecordTabProps) {
  const { config, buildConfig } = useConfig()
  const { mappedCameras, refreshDevices } = useMappedCameras()
  const { runPreflight, stopProcess, sendProcessInput } = useProcess()
  const running = useLeStudioStore((s) => !!s.procStatus.record)
  const clearLog = useLeStudioStore((s) => s.clearLog)
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const addToast = useLeStudioStore((s) => s.addToast)
  const [mode, setMode] = useState<'single' | 'bi'>('single')
  const [episodesDone, setEpisodesDone] = useState(0)

  const devices = useLeStudioStore((s) => s.devices)
  const armPaths = useMemo(() => {
    const all = new Set<string>()
    devices.arms.forEach((arm) => {
      if (arm.symlink) all.add(`/dev/${arm.symlink}`)
      if (arm.path) all.add(arm.path)
    })
    return [...all]
  }, [devices])

  useEffect(() => {
    if (!active) return
    refreshDevices()
    apiGet('/api/calibrate/list').catch(() => undefined)
  }, [active, refreshDevices])

  useEffect(() => {
    const robotMode = (config.robot_mode as string) ?? 'single'
    setMode(robotMode === 'bi' ? 'bi' : 'single')
  }, [config.robot_mode])

  const recordLines: LogLine[] = useLeStudioStore((s) => s.logLines.record ?? [])
  useEffect(() => {
    if (!active) return
    const latest = recordLines.at(-1)?.text ?? ''
    const match = latest.match(/[Ee]pisode[\s_](?:index=)?(\d+)/)
    if (match) setEpisodesDone(Number(match[1]))
  }, [active, recordLines])

  const update = (key: string, value: string | number | boolean) => {
    buildConfig({ [key]: value })
  }

  const getCfg = () => ({
    robot_mode: mode,
    robot_type: (config.robot_type as string) ?? 'so101_follower',
    teleop_type: (config.teleop_type as string) ?? 'so101_leader',
    follower_port: (config.follower_port as string) ?? '/dev/follower_arm_1',
    robot_id: (config.robot_id as string) ?? 'my_so101_follower_1',
    leader_port: (config.leader_port as string) ?? '/dev/leader_arm_1',
    teleop_id: (config.teleop_id as string) ?? 'my_so101_leader_1',
    left_follower_port: (config.left_follower_port as string) ?? '/dev/follower_arm_1',
    right_follower_port: (config.right_follower_port as string) ?? '/dev/follower_arm_2',
    left_leader_port: (config.left_leader_port as string) ?? '/dev/leader_arm_1',
    right_leader_port: (config.right_leader_port as string) ?? '/dev/leader_arm_2',
    record_task: (config.record_task as string) ?? '',
    record_episodes: Number(config.record_episodes ?? 50),
    record_repo_id: (config.record_repo_id as string) ?? 'user/my-dataset',
    record_resume: Boolean(config.record_resume),
    cameras: mappedCameras,
  })

  const start = async () => {
    clearLog('record')
    const cfg = getCfg()
    await buildConfig(cfg)
    if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(cfg.record_repo_id)) {
      appendLog('record', '[ERROR] Repo ID must be in "user/dataset" format', 'error')
      return
    }
    const ok = await runPreflight(cfg, 'record')
    if (!ok) return
    setEpisodesDone(0)
    const res = await apiPost<{ ok: boolean; error?: string; resume_requested?: boolean; resume_enabled?: boolean }>('/api/record/start', cfg)
    if (!res.ok) {
      appendLog('record', `[ERROR] ${res.error ?? 'failed to start'}`, 'error')
      return
    }
    if (res.resume_requested && !res.resume_enabled) {
      appendLog('record', '[INFO] Resume disabled because target dataset does not exist yet.', 'info')
    }
    addToast('Recording started', 'success')
  }

  const stop = async () => {
    await stopProcess('record')
    addToast('Recording stop requested', 'info')
  }

  const sendKey = async (key: 'right' | 'left' | 'escape') => {
    const res = await sendProcessInput('record', key)
    if (!res.ok) {
      addToast('Failed to send capture command', 'error')
      return
    }
    if (key === 'right') addToast('Episode saved', 'success')
    if (key === 'left') addToast('Episode discarded', 'error')
    if (key === 'escape') addToast('Recording ended', 'info')
  }

  const totalEpisodes = Number(config.record_episodes ?? 50)
  const pct = Math.max(0, Math.min(100, totalEpisodes > 0 ? (episodesDone / totalEpisodes) * 100 : 0))

  return (
    <section id="tab-record" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Record Dataset</h2>
        <div className="mode-toggle">
          <label>Recording Mode:</label>
          <button id="record-mode-single" className={`toggle ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
            Single
          </button>
          <button id="record-mode-bi" className={`toggle ${mode === 'bi' ? 'active' : ''}`} onClick={() => setMode('bi')}>
            Bi-Arm
          </button>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Step 1: Recording Plan</h3>
          <label>Task Description</label>
          <input value={(config.record_task as string) ?? ''} onChange={(e) => update('record_task', e.target.value)} />
          <label>Number of Episodes</label>
          <input type="number" min={1} value={totalEpisodes} onChange={(e) => update('record_episodes', Number(e.target.value))} />
          <label>Dataset Repo ID (Hugging Face)</label>
          <input value={(config.record_repo_id as string) ?? 'user/my-dataset'} onChange={(e) => update('record_repo_id', e.target.value)} />
          <label>
            <input
              id="record-resume"
              type="checkbox"
              checked={Boolean(config.record_resume)}
              onChange={(e) => update('record_resume', e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            Resume existing dataset
          </label>
        </div>

        <div className="card">
          <h3>Step 2: Arm Ports</h3>
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
              <label>Left Follower</label>
              <input value={(config.left_follower_port as string) ?? '/dev/follower_arm_1'} onChange={(e) => update('left_follower_port', e.target.value)} />
              <label>Right Follower</label>
              <input value={(config.right_follower_port as string) ?? '/dev/follower_arm_2'} onChange={(e) => update('right_follower_port', e.target.value)} />
              <label>Left Leader</label>
              <input value={(config.left_leader_port as string) ?? '/dev/leader_arm_1'} onChange={(e) => update('left_leader_port', e.target.value)} />
              <label>Right Leader</label>
              <input value={(config.right_leader_port as string) ?? '/dev/leader_arm_2'} onChange={(e) => update('right_leader_port', e.target.value)} />
            </>
          )}
        </div>

        <div className="card">
          <h3>Step 3: Camera Feeds</h3>
          <MappedCameraRows mappedCameras={mappedCameras} />
        </div>

        <div className="episode-progress-card">
          <div className="ep-card-title">Episode Progress</div>
          <div className="episode-status">
            <div className="ep-label">Episodes</div>
            <div className="ep-bar-wrap">
              <div className="ep-bar" id="record-ep-bar" style={{ width: `${pct}%` }} />
            </div>
            <div className="ep-status-row">
              <div className="ep-num">
                <span id="record-ep-current">{running ? episodesDone : '—'}</span>
                <span className="ep-sep">/</span>
                <span id="record-ep-total">{running ? totalEpisodes : '—'}</span>
              </div>
              <div id="record-state-pill" className={`ep-state-pill ${running ? 'running' : 'idle'}`}>
                {running ? 'Recording' : 'Idle'}
              </div>
            </div>
          </div>
          <div className="ep-actions-panel">
            <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Recording" />
            <div className="ep-controls-row" style={{ marginTop: 8 }}>
              <button className="btn-sm record-ep-action" disabled={!running} onClick={() => sendKey('right')}>
                ✓ Save →
              </button>
              <button className="btn-sm record-ep-action record-ep-discard" disabled={!running} onClick={() => sendKey('left')}>
                ✗ Discard ←
              </button>
              <button className="btn-sm record-ep-action record-ep-end" disabled={!running} onClick={() => sendKey('escape')}>
                ⏹ End (Esc)
              </button>
            </div>
          </div>
          <div className="terminal-card" style={{ marginTop: 10 }}>
            <LogConsole processName="record" />
          </div>
        </div>
      </div>
    </section>
  )
}
