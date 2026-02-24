import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import type { ArmDevice, CameraDevice, DevicesResponse } from '../lib/types'
import { useLeStudioStore } from '../store'

interface StatusTabProps {
  active: boolean
}

interface HistoryEntry {
  type: string
  ts: string
  meta?: Record<string, unknown>
}

interface ResourcesResponse {
  ok?: boolean
  cpu_percent?: number
  memory_percent?: number
  ram_percent?: number
  ram_used_mb?: number
  ram_total_mb?: number
  disk_percent?: number
  disk_used_gb?: number
  disk_total_gb?: number
  lerobot_cache_mb?: number | null
  cache_size_mb?: number | null
}

function asNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function clampPercent(value: number | null): number {
  if (value === null) return 0
  return Math.max(0, Math.min(100, value))
}

function pctText(value: number | null): string {
  return value === null ? '--%' : `${value.toFixed(1)}%`
}

function fmtSizeFromMb(value: number | null): string {
  if (value === null) return '--'
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`
  return `${value.toFixed(1)} MB`
}

function barSeverityClass(value: number | null): string {
  if (value === null) return ''
  if (value >= 90) return 'danger'
  if (value >= 75) return 'warn'
  return ''
}

function cameraSubtitle(camera: CameraDevice): string {
  const port = camera.kernels?.trim() || '?'
  const model = camera.model?.trim() || 'unknown model'
  return `/dev/${camera.device ?? '?'} · port ${port} · ${model}`
}

function armSubtitle(arm: ArmDevice): string {
  return `/dev/${arm.device ?? '?'}`
}

export function StatusTab({ active }: StatusTabProps) {
  const devices = useLeStudioStore((s) => s.devices)
  const setDevices = useLeStudioStore((s) => s.setDevices)
  const procStatus = useLeStudioStore((s) => s.procStatus)
  const addToast = useLeStudioStore((s) => s.addToast)
  const [resources, setResources] = useState<ResourcesResponse | null>(null)
  const [resourcesError, setResourcesError] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [lastUpdate, setLastUpdate] = useState('')

  const refresh = useCallback(async () => {
    const data = await apiGet<DevicesResponse>('/api/devices')
    setDevices({ cameras: data.cameras ?? [], arms: data.arms ?? [] })
    setLastUpdate(new Date().toLocaleTimeString())
  }, [setDevices])

  const refreshResources = useCallback(async () => {
    try {
      const data = await apiGet<ResourcesResponse>('/api/system/resources')
      setResources(data)
      setResourcesError(false)
    } catch {
      setResourcesError(true)
    }
  }, [])

  const refreshHistory = useCallback(async () => {
    const data = await apiGet<{ ok: boolean; entries: HistoryEntry[] }>('/api/history?limit=50')
    setHistory(Array.isArray(data.entries) ? data.entries : [])
  }, [])

  const clearHistory = useCallback(async () => {
    await apiPost('/api/history/clear', {})
    addToast('History cleared', 'info')
    await refreshHistory()
  }, [addToast, refreshHistory])

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
  }, [active, refresh, refreshHistory, refreshResources])

  useEffect(() => {
    if (!active || resources !== null) return
    const timeoutId = window.setTimeout(() => {
      setResourcesError(true)
    }, 10000)
    return () => window.clearTimeout(timeoutId)
  }, [active, resources])

  return (
    <section id="tab-status" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>System Status</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span id="status-last-update" style={{ fontSize: 11, color: 'var(--text2)' }}>
            {lastUpdate ? `Last updated: ${lastUpdate}` : ''}
          </span>
          <button id="status-refresh-btn" onClick={refresh} className="btn-sm">
            ↺ Refresh
          </button>
        </div>
      </div>

      <div className="status-grid">
        <div className="card">
          <h3>📷 Cameras</h3>
          <div id="status-cameras" className="device-list">
            {devices.cameras.length === 0 ? (
              <div className="device-item" style={{ color: 'var(--text2)', fontSize: 12 }}>No cameras detected. Connect a USB camera and click <strong>Refresh</strong>.</div>
            ) : (
              devices.cameras.map((camera, idx) => (
                <div className="device-item" key={`${camera.device ?? 'cam'}-${idx}`}>
                  <span className={`dot ${camera.symlink ? 'green' : 'yellow'}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dname">{camera.symlink ?? camera.device ?? 'unknown'}</div>
                    <div className="dsub">{cameraSubtitle(camera)}</div>
                  </div>
                  <span className={`dbadge ${camera.symlink ? 'badge-ok' : 'badge-warn'}`}>
                    {camera.symlink ? 'linked' : 'no link'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <h3>🦾 Arm Ports</h3>
          <div id="status-arms" className="device-list">
            {devices.arms.length === 0 ? (
              <div className="device-item" style={{ color: 'var(--text2)', fontSize: 12 }}>No arm ports detected. Connect an arm via USB and click <strong>Refresh</strong>.</div>
            ) : (
              devices.arms.map((arm, idx) => (
                <div className="device-item" key={`${arm.device ?? 'arm'}-${idx}`}>
                  <span className={`dot ${arm.symlink ? 'green' : 'yellow'}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dname">{arm.symlink ?? arm.device ?? 'unknown'}</div>
                    <div className="dsub">{armSubtitle(arm)}</div>
                  </div>
                  <span className={`dbadge ${arm.symlink ? 'badge-ok' : 'badge-warn'}`}>
                    {arm.symlink ? 'linked' : 'no link'}
                  </span>
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
              resourcesError ? (
                <div className="device-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--red)', fontSize: 12 }}>Failed to load system resources</span>
                  <button className="btn-xs" onClick={refreshResources}>Retry</button>
                </div>
              ) : (
                <div className="device-item">Loading…</div>
              )
            ) : (
              <>
                <div className="device-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="dname">CPU</span>
                    <span className="dsub">{pctText(asNumber(resources.cpu_percent))}</span>
                  </div>
                  <div className="usb-bus-bar-track">
                    <div
                      className={`usb-bar-fill ${barSeverityClass(asNumber(resources.cpu_percent))}`.trim()}
                      style={{ width: `${clampPercent(asNumber(resources.cpu_percent))}%` }}
                    />
                  </div>
                </div>

                <div className="device-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="dname">RAM</span>
                    <span className="dsub">{(() => {
                      const usedMb = asNumber(resources.ram_used_mb)
                      const totalMb = asNumber(resources.ram_total_mb)
                      if (usedMb !== null && totalMb !== null) return `${fmtSizeFromMb(usedMb)} / ${fmtSizeFromMb(totalMb)}`
                      return pctText(asNumber(resources.memory_percent ?? resources.ram_percent))
                    })()}</span>
                  </div>
                  <div className="usb-bus-bar-track">
                    <div
                      className={`usb-bar-fill ${barSeverityClass(asNumber(resources.memory_percent ?? resources.ram_percent))}`.trim()}
                      style={{ width: `${clampPercent(asNumber(resources.memory_percent ?? resources.ram_percent))}%` }}
                    />
                  </div>
                </div>

                <div className="device-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="dname">Disk (home)</span>
                    <span className="dsub">{`${String(resources.disk_used_gb ?? '--')} / ${String(resources.disk_total_gb ?? '--')} GB`}</span>
                  </div>
                  <div className="usb-bus-bar-track">
                    <div
                      className={`usb-bar-fill ${barSeverityClass(asNumber(resources.disk_percent))}`.trim()}
                      style={{ width: `${clampPercent(asNumber(resources.disk_percent))}%` }}
                    />
                  </div>
                </div>

                <div className="device-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="dname">LeRobot Cache</div>
                    <div className="dsub">~/.cache/huggingface/lerobot</div>
                  </div>
                  <span className="dsub">{fmtSizeFromMb(asNumber(resources.lerobot_cache_mb ?? resources.cache_size_mb ?? null))}</span>
                </div>
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
              <div className="device-item">No session events yet. Start calibration, recording, training, or eval to see history here.</div>
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
