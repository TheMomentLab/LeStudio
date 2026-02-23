import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import type { DevicesResponse } from '../lib/types'
import { useLeStudioStore } from '../store'

interface StatusTabProps {
  active: boolean
}

interface HistoryEntry {
  type: string
  ts: string
  meta?: Record<string, unknown>
}

export function StatusTab({ active }: StatusTabProps) {
  const devices = useLeStudioStore((s) => s.devices)
  const setDevices = useLeStudioStore((s) => s.setDevices)
  const procStatus = useLeStudioStore((s) => s.procStatus)
  const addToast = useLeStudioStore((s) => s.addToast)
  const [resources, setResources] = useState<Record<string, unknown> | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [lastUpdate, setLastUpdate] = useState('')

  const refresh = async () => {
    const data = await apiGet<DevicesResponse>('/api/devices')
    setDevices({ cameras: data.cameras ?? [], arms: data.arms ?? [] })
    setLastUpdate(new Date().toLocaleTimeString())
  }

  const refreshResources = async () => {
    const data = await apiGet<Record<string, unknown>>('/api/system/resources')
    setResources(data)
  }

  const refreshHistory = async () => {
    const data = await apiGet<{ ok: boolean; entries: HistoryEntry[] }>('/api/history?limit=50')
    setHistory(Array.isArray(data.entries) ? data.entries : [])
  }

  const clearHistory = async () => {
    await apiPost('/api/history/clear', {})
    addToast('History cleared', 'info')
    await refreshHistory()
  }

  useEffect(() => {
    if (!active) return
    refresh()
    refreshResources()
    refreshHistory()
    const rId = window.setInterval(refreshResources, 5000)
    const hId = window.setInterval(refreshHistory, 30000)
    return () => {
      window.clearInterval(rId)
      window.clearInterval(hId)
    }
  }, [active])

  return (
    <section id="tab-status" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>System Status</h2>
        <span id="status-last-update" style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 'auto' }}>
          {lastUpdate ? `Last updated: ${lastUpdate}` : ''}
        </span>
        <button id="status-refresh-btn" onClick={refresh} className="btn-sm">
          ↺ Refresh
        </button>
      </div>

      <div className="status-grid">
        <div className="card">
          <h3>📷 Cameras</h3>
          <div id="status-cameras" className="device-list">
            {devices.cameras.length === 0 ? (
              <div className="device-item">No cameras detected</div>
            ) : (
              devices.cameras.map((camera, idx) => (
                <div className="device-item" key={`${camera.device ?? 'cam'}-${idx}`}>
                  <span className={`dot ${camera.symlink ? 'green' : 'yellow'}`} />
                  <div>
                    <div className="dname">{camera.symlink ?? camera.device ?? 'unknown'}</div>
                    <div className="dsub">/dev/{camera.device ?? '?'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3>🦾 Arm Ports</h3>
          <div id="status-arms" className="device-list">
            {devices.arms.length === 0 ? (
              <div className="device-item">No arm ports detected</div>
            ) : (
              devices.arms.map((arm, idx) => (
                <div className="device-item" key={`${arm.device ?? 'arm'}-${idx}`}>
                  <span className={`dot ${arm.symlink ? 'green' : 'yellow'}`} />
                  <div>
                    <div className="dname">{arm.symlink ?? arm.device ?? 'unknown'}</div>
                    <div className="dsub">/dev/{arm.device ?? '?'}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3>⚡ Processes</h3>
          <div id="status-procs" className="device-list">
            {['teleop', 'record', 'calibrate', 'motor_setup', 'train', 'eval'].map((name) => {
              const running = !!procStatus[name]
              return (
                <div className="device-item" key={name}>
                  <span className={`dot ${running ? 'green pulse' : 'gray'}`} />
                  <div className="dname">{name}</div>
                  <span className={`dbadge ${running ? 'badge-run' : 'badge-idle'}`}>{running ? 'running' : 'idle'}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h3>🖥️ System Resources</h3>
          <div id="status-resources" className="device-list">
            {!resources ? (
              <div className="device-item">Loading…</div>
            ) : (
              <>
                <div className="device-item">CPU: {String(resources.cpu_percent ?? '--')}%</div>
                <div className="device-item">RAM: {String(resources.ram_percent ?? '--')}%</div>
                <div className="device-item">Disk: {String(resources.disk_percent ?? '--')}%</div>
              </>
            )}
          </div>
        </div>

        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>📋 Session History</h3>
            <button className="btn-sm" onClick={clearHistory} style={{ fontSize: 10 }}>
              Clear
            </button>
          </div>
          <div id="status-history" className="device-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
            {history.length === 0 ? (
              <div className="device-item">No session events yet.</div>
            ) : (
              [...history].reverse().map((entry, idx) => (
                <div className="device-item" key={`${entry.ts}-${idx}`}>
                  <div>
                    <div className="dname">{entry.type}</div>
                    <div className="dsub">{entry.ts}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
