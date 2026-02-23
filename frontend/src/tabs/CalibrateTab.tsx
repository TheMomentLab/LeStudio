import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useProcess } from '../hooks/useProcess'
import { apiDelete, apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'
import type { LogLine, RobotsResponse } from '../lib/types'

interface CalibrateTabProps {
  active: boolean
}

const DEFAULT_ARM_TYPES = ['so101_follower', 'so100_follower', 'so101_leader', 'so100_leader']

const IDENTIFY_DEFAULT_MSG = 'Disconnect one arm, then click Start to begin identification.'
const EMPTY_CAL_LINES: LogLine[] = []
const MOTOR_ROW_RE = /^([a-zA-Z0-9_]+)\s+\|\s+(-?\d+)\s+\|\s+(-?\d+)\s+\|\s+(-?\d+)\s*$/
const MOTOR_HEADER_RE = /^NAME\s+\|\s+MIN\s+\|\s+POS/i
const MOTOR_SEPARATOR_RE = /^-{8,}\s*$/

function truncatePath(fullPath: string): string {
  const homeMatch = fullPath.match(/^\/home\/[^/]+\//)
  if (homeMatch) return fullPath.replace(homeMatch[0], '~/')
  return fullPath
}



export function CalibrateTab({ active }: CalibrateTabProps) {
  const running = useLeStudioStore((s) => !!s.procStatus.calibrate)
  const addToast = useLeStudioStore((s) => s.addToast)
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const clearLog = useLeStudioStore((s) => s.clearLog)
  const devices = useLeStudioStore((s) => s.devices)
  const calibrateLines = useLeStudioStore((s) => s.logLines.calibrate ?? EMPTY_CAL_LINES)
  const { stopProcess } = useProcess()
  const [type, setType] = useState('so101_follower')
  const [id, setId] = useState('my_arm_1')
  const [port, setPort] = useState('/dev/follower_arm_1')
  const [fileStatus, setFileStatus] = useState('Checking...')
  const [fileMeta, setFileMeta] = useState('')
  const [files, setFiles] = useState<Array<{ id: string; guessed_type: string; modified?: string }>>([])
  const [fileFilter, setFileFilter] = useState<string>('all')
  const [showIdentifyPanel, setShowIdentifyPanel] = useState(false)
  const [identifyRunning, setIdentifyRunning] = useState(false)
  const [identifyMessage, setIdentifyMessage] = useState(IDENTIFY_DEFAULT_MSG)
  const [identifyResult, setIdentifyResult] = useState('')
  const identifyPollTimer = useRef<number | null>(null)
  const identifySnapshot = useRef<Set<string> | null>(null)
  const filteredFiles = fileFilter === 'all' ? files : files.filter((f) => f.guessed_type === fileFilter)
  const [armTypes, setArmTypes] = useState<string[]>(DEFAULT_ARM_TYPES)

  // #6: Auto-match Arm Port when Arm Role Type changes
  useEffect(() => {
    const isFollower = type.includes('follower')
    const defaultPort = isFollower ? '/dev/follower_arm_1' : '/dev/leader_arm_1'
    const matchingArm = devices.arms.find((arm) => {
      const sym = arm.symlink ?? ''
      return isFollower ? sym.includes('follower') : sym.includes('leader')
    })
    const bestPort = matchingArm ? (matchingArm.path ?? `/dev/${matchingArm.device}`) : defaultPort
    setPort(bestPort)
  }, [type, devices.arms])


  const motorRows = useMemo(() => {
    const rows: Array<{ name: string; min: number; pos: number; max: number }> = []
    const byName = new Map<string, number>()

    for (const lineItem of calibrateLines) {
      const line = lineItem.text ?? ''
      if (!line || MOTOR_HEADER_RE.test(line) || MOTOR_SEPARATOR_RE.test(line)) continue

      const match = line.match(MOTOR_ROW_RE)
      if (!match) continue

      const parsed = {
        name: match[1],
        min: Number(match[2]),
        pos: Number(match[3]),
        max: Number(match[4]),
      }
      if (!Number.isFinite(parsed.min) || !Number.isFinite(parsed.pos) || !Number.isFinite(parsed.max)) continue

      const index = byName.get(parsed.name)
      if (index === undefined) {
        byName.set(parsed.name, rows.length)
        rows.push(parsed)
      } else {
        rows[index] = parsed
      }
    }

    return rows
  }, [calibrateLines])

  const stopIdentify = useCallback(() => {
    if (identifyPollTimer.current !== null) {
      window.clearInterval(identifyPollTimer.current)
      identifyPollTimer.current = null
    }
    identifySnapshot.current = null
    setIdentifyRunning(false)
    setIdentifyMessage(IDENTIFY_DEFAULT_MSG)
    setIdentifyResult('')
  }, [])

  const startIdentify = () => {
    identifySnapshot.current = new Set((devices.arms ?? []).map((arm) => arm.device).filter((device): device is string => !!device))
    setIdentifyRunning(true)
    setIdentifyMessage('Reconnect the arm now... Waiting for changes...')
    setIdentifyResult('')

    if (identifyPollTimer.current !== null) {
      window.clearInterval(identifyPollTimer.current)
    }

    identifyPollTimer.current = window.setInterval(async () => {
      try {
        const data = await apiGet<{ arms?: Array<{ device?: string; path?: string; serial?: string; kernels?: string }> }>('/api/devices')
        const oldDevices = identifySnapshot.current
        if (!oldDevices) return

        const detected = (data.arms ?? []).find((arm) => !!arm.device && !oldDevices.has(arm.device))
        if (!detected || !detected.device) return

        if (identifyPollTimer.current !== null) {
          window.clearInterval(identifyPollTimer.current)
          identifyPollTimer.current = null
        }
        identifySnapshot.current = null
        setIdentifyRunning(false)
        setIdentifyMessage('Arm detected!')
        setIdentifyResult(
          `${detected.path ?? `/dev/${detected.device}`}${detected.serial ? ` · serial: ${detected.serial}` : ''}${detected.kernels ? ` · kernels: ${detected.kernels}` : ''}`,
        )
      } catch (error) {
        void error
      }
    }, 1500)
  }

  const checkFile = useCallback(async () => {
    const res = await apiGet<{ exists: boolean; path: string; modified?: string; size?: number }>(`/api/calibrate/file?robot_type=${encodeURIComponent(type)}&robot_id=${encodeURIComponent(id)}`)
    if (res.exists) {
      setFileStatus('Found')
      setFileMeta(`${truncatePath(res.path)}\nModified: ${res.modified ?? ''} (${res.size ?? ''} bytes)`)
      return
    }
    setFileStatus('Missing')
    setFileMeta(`Will create new file:\n${truncatePath(res.path)}`)
  }, [id, type])

  const refreshFiles = useCallback(async () => {
    const res = await apiGet<{ files: Array<{ id: string; guessed_type: string; modified?: string }> }>('/api/calibrate/list')
    setFiles(res.files ?? [])
  }, [])

  const deleteFile = async (fileId: string, guessedType: string, modified?: string) => {
    const confirmed = window.confirm(
      `Delete calibration file?\n\nFile: ${fileId}\nType: ${guessedType}\nLast modified: ${modified ?? 'unknown'}\n\nThis cannot be undone. You will need to recalibrate.`,
    )
    if (!confirmed) return

    const res = await apiDelete<{ ok: boolean; error?: string }>(
      `/api/calibrate/file?robot_type=${encodeURIComponent(guessedType)}&robot_id=${encodeURIComponent(fileId)}`,
    )

    if (!res.ok) {
      addToast(res.error ?? 'Failed to delete calibration file', 'error')
      return
    }

    addToast('Calibration file deleted', 'success')
    await refreshFiles()
    await checkFile()
  }

  useEffect(() => {
    if (!active) return
    refreshFiles()
    checkFile()
  }, [active, checkFile, refreshFiles])


  useEffect(() => {
    if (!active) return
    apiGet<RobotsResponse>('/api/robots').then((r) => {
      const types = r.types ?? DEFAULT_ARM_TYPES
      if (types.length > 0) setArmTypes(types)
    })
  }, [active])

  useEffect(() => {
    if (active) return
    stopIdentify()
  }, [active, stopIdentify])

  useEffect(
    () => () => {
      stopIdentify()
    },
    [stopIdentify],
  )

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
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {armTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label>Arm ID</label>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {files.length === 0 ? (
              <option value={id}>{id}</option>
            ) : (() => {
              const leaderFiles = files.filter((f) => f.guessed_type.includes('leader'))
              const followerFiles = files.filter((f) => f.guessed_type.includes('follower'))
              const otherFiles = files.filter((f) => !f.guessed_type.includes('leader') && !f.guessed_type.includes('follower'))
              return (
                <>
                  {followerFiles.length > 0 && <optgroup label="Follower">
                    {followerFiles.map((f) => <option key={`${f.id}-${f.guessed_type}`} value={f.id}>{f.id}</option>)}
                  </optgroup>}
                  {leaderFiles.length > 0 && <optgroup label="Leader">
                    {leaderFiles.map((f) => <option key={`${f.id}-${f.guessed_type}`} value={f.id}>{f.id}</option>)}
                  </optgroup>}
                  {otherFiles.length > 0 && <optgroup label="Other">
                    {otherFiles.map((f) => <option key={`${f.id}-${f.guessed_type}`} value={f.id}>{f.id}</option>)}
                  </optgroup>}
                </>
              )
            })()}
          </select>
          <label>Arm Port</label>
          <select value={port} onChange={(e) => setPort(e.target.value)}>
            {devices.arms.length === 0 ? (
              <option value={port}>{port}</option>
            ) : (
              devices.arms.map((arm, idx) => {
                const p = arm.path ?? `/dev/${arm.device ?? 'ttyUSB' + idx}`
                return <option key={p} value={p}>{arm.symlink ?? p}</option>
              })
            )}
          </select>
          <div className="info-box" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Calibration File</span>
              <span id="cal-file-status" className={`dbadge ${fileStatus === 'Found' ? 'badge-ok' : 'badge-warn'}`}>
                {fileStatus}
              </span>
            </div>
            <div id="cal-file-meta" style={{ fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.8, wordBreak: 'break-all', whiteSpace: 'pre-line' }}>
              {fileMeta}
            </div>
          </div>
          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Calibration" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ marginBottom: 0 }}>Connected Arms</h3>
              <button
                type="button"
                className="btn-sm"
                onClick={() => {
                  setShowIdentifyPanel((prev) => {
                    if (prev) stopIdentify()
                    return !prev
                  })
                }}
              >
                🔍 Identify Arm
              </button>
            </div>
            <div
              id="arm-identify-panel"
              style={{
                display: showIdentifyPanel ? 'block' : 'none',
                marginBottom: 14,
                padding: 14,
                background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                This helps identify which arm appears after reconnecting it.
              </div>
              <div id="arm-identify-msg" style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                {identifyMessage}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <button
                  id="arm-identify-start-btn"
                  type="button"
                  className="btn-primary"
                  style={{ display: identifyRunning ? 'none' : 'inline-flex' }}
                  onClick={startIdentify}
                >
                  Start Identify
                </button>
                <button
                  id="arm-identify-stop-btn"
                  type="button"
                  className="btn-danger"
                  style={{ display: identifyRunning ? 'inline-flex' : 'none' }}
                  onClick={stopIdentify}
                >
                  Cancel
                </button>
              </div>
              <div
                id="arm-identify-result"
                style={{
                  display: identifyResult ? 'block' : 'none',
                  marginTop: 10,
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  wordBreak: 'break-all',
                }}
              >
                {identifyResult}
              </div>
            </div>
            <div className="device-list">
              {devices.arms.length === 0 ? (
                <div className="device-item">—</div>
              ) : (
                devices.arms.map((arm, idx) => (
                  <div className="device-item" key={`${arm.device ?? 'arm'}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="dot green" />
                      <div className="dname">{arm.symlink ?? arm.device}</div>
                    </div>
                    <div className="dsub">{arm.path}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0, maxHeight: 280, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ marginBottom: 0 }}>Existing Files</h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select
                  className="btn-sm"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  {armTypes.map((t) => (
                    <option key={`filter-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-xs"
                  style={{ padding: '4px 6px' }}
                  aria-label="Refresh calibration files"
                  onClick={refreshFiles}
                >
                  ↺
                </button>
              </div>
            </div>
            <div className="device-list">
              {filteredFiles.length === 0
                ? 'No calibration files found'
                : fileFilter === 'all' ? (
                  <>
                    {Object.entries(
                      filteredFiles.reduce<Record<string, typeof filteredFiles>>((acc, f) => {
                        const key = f.guessed_type
                        if (!acc[key]) acc[key] = []
                        acc[key].push(f)
                        return acc
                      }, {})
                    ).map(([gtype, gfiles]) => (
                      <div key={gtype}>
                        <div style={{ fontSize: 10, color: 'var(--text2)', margin: '12px 0 6px 4px', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>{gtype}</div>
                        {gfiles.map((f) => (
                          <div key={`${f.id}-${f.guessed_type}`} className="device-item" style={{ cursor: 'pointer', marginBottom: 4 }} onClick={() => {
                            setId(f.id)
                            if (armTypes.includes(f.guessed_type)) setType(f.guessed_type)
                          }}>
                            <span className="dot green" />
                            <div style={{ flex: 1 }}>
                              <div className="dname">{f.id}</div>
                              <div className="dsub">{f.modified ?? ''}</div>
                            </div>
                            <button type="button" className="btn-xs" style={{ color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }} onClick={(e) => { e.stopPropagation(); deleteFile(f.id, f.guessed_type, f.modified) }}>Delete…</button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                ) : filteredFiles.map((f) => (
                    <div key={`${f.id}-${f.guessed_type}`} className="device-item" style={{ cursor: 'pointer', marginBottom: 4 }} onClick={() => {
                      setId(f.id)
                      if (armTypes.includes(f.guessed_type)) setType(f.guessed_type)
                    }}>
                      <span className="dot green" />
                      <div style={{ flex: 1 }}>
                        <div className="dname">{f.id}</div>
                        <div className="dsub">{f.modified ?? ''}</div>
                      </div>
                      <button type="button" className="btn-xs" style={{ color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }} onClick={(e) => { e.stopPropagation(); deleteFile(f.id, f.guessed_type, f.modified) }}>Delete…</button>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" id="cal-live-table" style={{ maxWidth: 480 }}>
        <h3>Live Motor Ranges</h3>
        {motorRows.length === 0 ? (
          <div id="cal-motor-placeholder" className="muted" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            Waiting for calibration…<br />Start process to see live ranges.
          </div>
        ) : (
          <div id="cal-motor-list" className="motor-list">
            {motorRows.map((row) => {
              const maxVal = 4095
              const clamp = (value: number) => Math.max(0, Math.min(maxVal, value))
              const cMin = clamp(row.min)
              const cPos = clamp(row.pos)
              const cMax = clamp(row.max)
              const leftPct = (cMin / maxVal) * 100
              const widthPct = Math.max(0, ((cMax - cMin) / maxVal) * 100)
              const posPct = (cPos / maxVal) * 100

              return (
                <div className="motor-row" id={`motor-row-${row.name}`} key={row.name}>
                  <div className="motor-name">{row.name}</div>
                  <div className="motor-track-wrap">
                    <div className="motor-track">
                      <div className="motor-range" id={`motor-range-${row.name}`} style={{ left: `${leftPct}%`, width: `${widthPct}%` }} />
                      <div className="motor-pos" id={`motor-pos-${row.name}`} style={{ left: `${posPct}%` }} />
                    </div>
                  </div>
                  <div className="motor-vals">
                    <div>
                      <span className="lbl">MIN</span>
                      <span className="val-min" id={`motor-vmin-${row.name}`}>{row.min}</span>
                    </div>
                    <div>
                      <span className="lbl">POS</span>
                      <span className="val-pos" id={`motor-vpos-${row.name}`}>{row.pos}</span>
                    </div>
                    <div>
                      <span className="lbl">MAX</span>
                      <span className="val-max" id={`motor-vmax-${row.name}`}>{row.max}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
