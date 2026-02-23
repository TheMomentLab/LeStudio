import { useEffect, useState } from 'react'
import { LogConsole } from '../components/shared/LogConsole'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'

interface CalibrateTabProps {
  active: boolean
}

export function CalibrateTab({ active }: CalibrateTabProps) {
  const running = useLeStudioStore((s) => !!s.procStatus.calibrate)
  const addToast = useLeStudioStore((s) => s.addToast)
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const clearLog = useLeStudioStore((s) => s.clearLog)
  const devices = useLeStudioStore((s) => s.devices)
  const { stopProcess } = useProcess()
  const [type, setType] = useState('so101_follower')
  const [id, setId] = useState('my_so101_follower_1')
  const [port, setPort] = useState('/dev/follower_arm_1')
  const [fileStatus, setFileStatus] = useState('Checking...')
  const [fileMeta, setFileMeta] = useState('')
  const [files, setFiles] = useState<Array<{ id: string; guessed_type: string; modified?: string }>>([])

  const checkFile = async () => {
    const res = await apiGet<{ exists: boolean; path: string; modified?: string; size?: number }>(`/api/calibrate/file?robot_type=${encodeURIComponent(type)}&robot_id=${encodeURIComponent(id)}`)
    if (res.exists) {
      setFileStatus('Found')
      setFileMeta(`${res.path} · ${res.modified ?? ''} · ${res.size ?? ''}`)
      return
    }
    setFileStatus('Missing')
    setFileMeta(`Will create: ${res.path}`)
  }

  const refreshFiles = async () => {
    const res = await apiGet<{ files: Array<{ id: string; guessed_type: string; modified?: string }> }>('/api/calibrate/list')
    setFiles(res.files ?? [])
  }

  useEffect(() => {
    if (!active) return
    refreshFiles()
    checkFile()
  }, [active, type, id])

  const start = async () => {
    clearLog('calibrate')
    const res = await apiPost<{ ok: boolean; error?: string }>('/api/calibrate/start', { robot_type: type, robot_id: id, port })
    if (!res.ok) {
      appendLog('calibrate', `[ERROR] ${res.error ?? 'failed to start calibration'}`, 'error')
      return
    }
    addToast('Calibration started', 'success')
  }

  const stop = async () => {
    await stopProcess('calibrate')
    addToast('Calibration stop requested', 'info')
    await refreshFiles()
    await checkFile()
  }

  return (
    <section id="tab-calibrate" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Calibration</h2>
      </div>
      <div className="two-col">
        <div className="card">
          <h3>Step 1: Arm Selection</h3>
          <label>Arm Role Type</label>
          <input value={type} onChange={(e) => setType(e.target.value)} />
          <label>Arm ID</label>
          <input value={id} onChange={(e) => setId(e.target.value)} />
          <label>Arm Port</label>
          <input value={port} onChange={(e) => setPort(e.target.value)} />
          <div className="info-box" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Calibration File</span>
              <span id="cal-file-status" className={`dbadge ${fileStatus === 'Found' ? 'badge-ok' : 'badge-warn'}`}>
                {fileStatus}
              </span>
            </div>
            <div id="cal-file-meta" style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.8 }}>
              {fileMeta}
            </div>
          </div>
          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Calibration" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Connected Arms</h3>
            <div className="device-list">
              {devices.arms.length === 0 ? (
                <div className="device-item">—</div>
              ) : (
                devices.arms.map((arm, idx) => (
                  <div className="device-item" key={`${arm.device ?? 'arm'}-${idx}`}>
                    <div className="dname">{arm.symlink ?? arm.device}</div>
                    <div className="dsub">{arm.path}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0, maxHeight: 280, overflowY: 'auto' }}>
            <h3>Existing Files</h3>
            <div className="device-list">
              {files.length === 0
                ? 'No calibration files found'
                : files.map((f) => (
                    <div key={`${f.id}-${f.guessed_type}`} className="device-item" onClick={() => {
                      setId(f.id)
                      setType(f.guessed_type)
                    }}>
                      <span className="dot green" />
                      <div>
                        <div className="dname">{f.id}</div>
                        <div className="dsub">{f.modified ?? ''}</div>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" id="cal-live-table" style={{ maxWidth: 480 }}>
        <h3>Live motor ranges</h3>
        <div className="muted">Live motor range table is streamed through process output.</div>
      </div>

      <LogConsole processName="calibrate" />
    </section>
  )
}
