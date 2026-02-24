import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useConfig } from '../hooks/useConfig'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import type { DatasetListItem, LogLine } from '../lib/types'
import { useLeStudioStore } from '../store'

const EMPTY_TRAIN_LINES: LogLine[] = []

interface TrainTabProps {
  active: boolean
}

interface GpuStatusResponse {
  exists: boolean
  utilization?: number
  memory_used?: number
  memory_total?: number
  memory_percent?: number
  error?: string
}

interface CheckpointItem {
  name: string
  path: string
  display?: string
  step?: number | null
  policy?: string | null
  size_mb?: number | null
}

const TRAIN_STEP_RE = /\bstep\s*[:=]\s*([0-9]+(?:\.[0-9]+)?[KMBTQ]?)/i
const TRAIN_LOSS_RE = /\bloss\s*[:=]\s*([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)/i
const TRAIN_TOTAL_RE = /cfg\.steps=([0-9_,]+)/i

function parseCompactNumber(token: string): number | null {
  const raw = token.trim().toUpperCase()
  const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)([KMBTQ]?)$/)
  if (!match) {
    const value = Number(raw.replace(/,/g, ''))
    return Number.isFinite(value) ? Math.floor(value) : null
  }
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  const unit = match[2]
  const mult = unit === 'K' ? 1_000 : unit === 'M' ? 1_000_000 : unit === 'B' ? 1_000_000_000 : unit === 'T' ? 1_000_000_000_000 : unit === 'Q' ? 1_000_000_000_000_000 : 1
  return Math.floor(value * mult)
}

function formatEta(seconds: number | null): string {
  if (!Number.isFinite(seconds) || seconds === null || seconds < 0) return '--'
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

export function TrainTab({ active }: TrainTabProps) {
  const running = useLeStudioStore((s) => !!s.procStatus.train || !!s.procStatus.train_install)

  const trainLogs = useLeStudioStore((s) => s.logLines.train ?? EMPTY_TRAIN_LINES)
  const { config, buildConfig } = useConfig()
  const { stopProcess, runPreflight } = useProcess()
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const addToast = useLeStudioStore((s) => s.addToast)
  const setSidebarSignals = useLeStudioStore((s) => s.setSidebarSignals)
  const [source, setSource] = useState<'local' | 'hf'>('local')
  const [datasets, setDatasets] = useState<DatasetListItem[]>([])
  const [gpuStatus, setGpuStatus] = useState<GpuStatusResponse | null>(null)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [checkpointsLoading, setCheckpointsLoading] = useState(false)
  const [gpuTimedOut, setGpuTimedOut] = useState(false)
  const [checkpointsTimedOut, setCheckpointsTimedOut] = useState(false)
  const [preflightAction, setPreflightAction] = useState('')
  const [preflightReason, setPreflightReason] = useState('')
  const [preflightOk, setPreflightOk] = useState(true)
  const lossCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const trainSteps = Number(config.train_steps ?? 100000)
  const localRepoId = useMemo(() => {
    const configured = (config.train_repo_id as string) ?? ''
    if (configured && datasets.some((ds) => ds.id === configured)) return configured
    return datasets[0]?.id ?? '__none__'
  }, [config.train_repo_id, datasets])

  const progress = useMemo(() => {
    let total = trainSteps > 0 ? trainSteps : null
    let current: number | null = null
    let latestLoss: number | null = null
    let firstStepTs: number | null = null
    let firstStepVal: number | null = null
    let lastStepTs: number | null = null
    let lastStepVal: number | null = null
    const lossSeries: number[] = []

    for (const line of trainLogs) {
      const totalMatch = line.text.match(TRAIN_TOTAL_RE)
      if (totalMatch) {
        const parsed = Number(totalMatch[1].replace(/[,_]/g, ''))
        if (Number.isFinite(parsed) && parsed > 0) total = parsed
      }

      const stepMatch = line.text.match(TRAIN_STEP_RE)
      if (stepMatch) {
        const parsedStep = parseCompactNumber(stepMatch[1])
        if (parsedStep !== null && parsedStep >= 0) {
          current = parsedStep
          if (firstStepTs === null || firstStepVal === null) {
            firstStepTs = line.ts
            firstStepVal = parsedStep
          }
          lastStepTs = line.ts
          lastStepVal = parsedStep
        }
      }

      const lossMatch = line.text.match(TRAIN_LOSS_RE)
      if (lossMatch) {
        const parsedLoss = Number(lossMatch[1])
        if (Number.isFinite(parsedLoss)) {
          latestLoss = parsedLoss
          lossSeries.push(parsedLoss)
        }
      }
    }

    const pct = Math.max(0, Math.min(100, current !== null && total && total > 0 ? (current / total) * 100 : 0))
    let etaSeconds: number | null = null
    if (running && current !== null && total && total > current && firstStepTs !== null && firstStepVal !== null && lastStepTs !== null && lastStepVal !== null) {
      const elapsedSeconds = Math.max(0, (lastStepTs - firstStepTs) / 1000)
      const progressed = Math.max(0, lastStepVal - firstStepVal)
      if (elapsedSeconds > 0 && progressed > 0) {
        const stepsPerSecond = progressed / elapsedSeconds
        if (stepsPerSecond > 0) etaSeconds = (total - current) / stepsPerSecond
      }
    }

    return {
      totalSteps: total,
      currentStep: current,
      latestLoss,
      etaText: formatEta(etaSeconds),
      progressPct: pct,
      lossSeries: lossSeries.slice(-300),
    }
  }, [running, trainLogs, trainSteps])

  const refreshDatasets = useCallback(async () => {
    const res = await apiGet<{ datasets: DatasetListItem[] }>('/api/datasets')
    setDatasets(res.datasets ?? [])
  }, [])

  const refreshGpu = useCallback(async () => {
    try {
      const res = await apiGet<GpuStatusResponse>('/api/gpu/status')
      setGpuStatus(res)
      setGpuTimedOut(false)
    } catch { /* GPU unavailable */ }
  }, [])

  const refreshCheckpoints = useCallback(async () => {
    setCheckpointsLoading(true)
    try {
      const res = await apiGet<{ ok?: boolean; checkpoints?: CheckpointItem[] }>('/api/checkpoints')
      setCheckpoints(res.checkpoints ?? [])
    } finally {
      setCheckpointsLoading(false)
      setCheckpointsTimedOut(false)
    }
  }, [])

  const refreshPreflight = useCallback(async () => {
    const device = (config.train_device as string) ?? 'cuda'
    const res = await apiGet<{ ok: boolean; reason?: string; action?: string }>(`/api/train/preflight?device=${encodeURIComponent(device)}`)
    setPreflightOk(!!res.ok)
    setPreflightAction(res.action ?? '')
    setPreflightReason(res.reason ?? '')
    setSidebarSignals({ trainMissingDep: !res.ok })
    return !!res.ok
  }, [config.train_device, setSidebarSignals])

  const installCudaTorch = async () => {
    appendLog('train', '[INFO] Starting PyTorch CUDA installer from GUI...', 'info')
    try {
      const res = await apiPost<{ ok: boolean; error?: string }>('/api/train/install_pytorch', { nightly: true, cuda_tag: 'cu128' })
      if (!res.ok) {
        appendLog('train', `[ERROR] ${res.error ?? 'Failed to start CUDA installer.'}`, 'error')
        return
      }
      addToast('CUDA PyTorch install started', 'info')
    } catch (e) {
      appendLog('train', `[ERROR] ${e instanceof Error ? e.message : 'Installer request failed.'}`, 'error')
    }
  }

  useEffect(() => {
    if (!active) return
    const nextSource = (config.train_dataset_source as string) === 'hf' ? 'hf' : 'local'
    setSource(nextSource)
    refreshDatasets()
    refreshGpu()
    refreshCheckpoints()
    refreshPreflight()
  }, [active, config.train_dataset_source, refreshCheckpoints, refreshDatasets, refreshGpu, refreshPreflight])

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      refreshGpu()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [active, refreshGpu])

  useEffect(() => {
    if (!active || gpuStatus !== null) return
    const timer = window.setTimeout(() => {
      setGpuTimedOut(true)
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [active, gpuStatus])

  useEffect(() => {
    if (!active || !checkpointsLoading) return
    const timer = window.setTimeout(() => {
      setCheckpointsTimedOut(true)
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [active, checkpointsLoading])

  useEffect(() => {
    const canvas = lossCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = Math.max(1, Math.floor(canvas.clientWidth || canvas.width || 560))
    const height = Math.max(1, Math.floor(canvas.clientHeight || canvas.height || 200))
    const dpr = Math.max(1, window.devicePixelRatio || 1)

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const values = progress.lossSeries
    if (values.length === 0) return

    const padL = 40
    const padR = 14
    const padT = 14
    const padB = 20
    const innerW = width - padL - padR
    const innerH = height - padT - padB
    if (innerW < 10 || innerH < 10) return

    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const v of values) {
      if (v < min) min = v
      if (v > max) max = v
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return
    const span = max - min || 1
    min -= span * 0.08
    max += span * 0.08

    ctx.strokeStyle = 'rgba(148,163,184,0.12)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i += 1) {
      const y = padT + (i / 4) * innerH
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(padL + innerW, y)
      ctx.stroke()
    }

    const yFor = (value: number) => padT + innerH - ((value - min) / (max - min)) * innerH
    const xFor = (index: number) => padL + (index / Math.max(1, values.length - 1)) * innerW

    ctx.beginPath()
    for (let i = 0; i < values.length; i += 1) {
      const x = xFor(i)
      const y = yFor(values[i])
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#86efac'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.strokeStyle = 'rgba(148,163,184,0.18)'
    ctx.lineWidth = 1
    ctx.strokeRect(padL, padT, innerW, innerH)
  }, [progress.lossSeries])

  const repoId = source === 'local' ? localRepoId : ((config.train_repo_id as string) ?? 'user/my-dataset')

  const start = async () => {
    if (source === 'local' && repoId === '__none__') {
      appendLog('train', '[ERROR] No local dataset found. Switch to Hugging Face or create a local dataset first.', 'error')
      return
    }

    const cfg = {
      train_policy: (config.train_policy as string) ?? 'act',
      train_repo_id: repoId,
      train_steps: Number(config.train_steps ?? 100000),
      train_device: (config.train_device as string) ?? 'cuda',
      train_batch_size: Number(config.train_batch_size ?? 0) || undefined,
      train_lr: (config.train_lr as string) || undefined,
    }
    await buildConfig({ ...cfg, train_dataset_source: source })
    const preflight = await refreshPreflight()
    if (!preflight) {
      appendLog('train', '[ERROR] Device compatibility check failed.', 'error')
      return
    }
    const ok = await runPreflight(cfg as Record<string, unknown>, 'train')
    if (!ok) return
    const res = await apiPost<{ ok: boolean; error?: string }>('/api/train/start', cfg)
    if (!res.ok) {
      appendLog('train', `[ERROR] ${res.error ?? 'failed to start train'}`, 'error')
      return
    }
    addToast('Training started', 'success')
    refreshCheckpoints()
  }

  const stop = async () => {
    await stopProcess('train')
    addToast('Training stop requested', 'info')
  }

  const applyPreset = (preset: 'quick' | 'standard' | 'full') => {
    const steps = preset === 'quick' ? 1000 : preset === 'standard' ? 50000 : 100000
    buildConfig({ train_steps: steps })
  }

  return (
    <section id="tab-train" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Train Policy</h2>
      </div>


      <div className="quick-guide">
        <h3>Training Guide</h3>
        <p>Training can take <strong>hours to days</strong> depending on hardware and dataset size. Closing the GUI or restarting the server will <strong>terminate the process</strong>. Monitor real-time progress and loss values in the <strong>global console drawer</strong>.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="card">
          <h3>Configuration</h3>
          <label>Policy Type</label>
          <select value={(config.train_policy as string) ?? 'act'} onChange={(e) => buildConfig({ train_policy: e.target.value })}>
            <option value="act">ACT (Action Chunking with Transformers)</option>
            <option value="diffusion">Diffusion Policy</option>
            <option value="tdmpc2">TD-MPC2</option>
          </select>
          <label>Dataset Source</label>
          <div className="mode-toggle" style={{ marginLeft: 0, marginBottom: 8 }}>
            <button className={`toggle ${source === 'local' ? 'active' : ''}`} onClick={() => setSource('local')}>
              Local
            </button>
            <button className={`toggle ${source === 'hf' ? 'active' : ''}`} onClick={() => setSource('hf')}>
              Hugging Face
            </button>
          </div>
          {source === 'local' ? (
            <>
              <label>Local Dataset</label>
              <select value={repoId} onChange={(e) => buildConfig({ train_repo_id: e.target.value })}>
                {datasets.length === 0 ? <option value="__none__">No local datasets — record in Record tab first</option> : null}
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.id}
                  </option>
                ))}
              </select>
              <div className="field-help" style={{ marginTop: 4 }}>Choose a dataset from local cache (`~/.cache/huggingface/lerobot`).</div>
            </>
          ) : (
            <>
              <label>Dataset Repo ID</label>
              <input type="text" value={(config.train_repo_id as string) ?? 'user/my-dataset'} onChange={(e) => buildConfig({ train_repo_id: e.target.value })} />
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4 }}>
            <label style={{ margin: 0 }}>Training Steps</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-xs" onClick={() => applyPreset('quick')}>
                Quick (1K)
              </button>
              <button className="btn-xs" onClick={() => applyPreset('standard')}>
                Standard (50K)
              </button>
              <button className="btn-xs" onClick={() => applyPreset('full')}>
                Full (100K)
              </button>
            </div>
          </div>
          <input type="number" value={trainSteps} onChange={(e) => buildConfig({ train_steps: Number(e.target.value) })} />
          <div className="advanced-only" style={{ marginTop: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'color-mix(in srgb, var(--bg3) 60%, transparent)' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 600, letterSpacing: 0.2 }}>ADVANCED PARAMS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ marginBottom: 3 }}>Batch Size</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="default (64)"
                  value={typeof config.train_batch_size === 'number' ? config.train_batch_size : ''}
                  onChange={(e) => buildConfig({ train_batch_size: e.target.value.trim() ? Number(e.target.value) : undefined })}
                />
                <div className="field-help">Samples per gradient step.</div>
              </div>
              <div>
                <label style={{ marginBottom: 3 }}>Learning Rate</label>
                <input
                  type="text"
                  placeholder="default (1e-4)"
                  value={(config.train_lr as string) ?? ''}
                  onChange={(e) => buildConfig({ train_lr: e.target.value })}
                />
                <div className="field-help">e.g. 1e-4, 0.0001</div>
              </div>
            </div>
          </div>
          <label>Compute Device</label>
          <select value={(config.train_device as string) ?? 'cuda'} onChange={(e) => buildConfig({ train_device: e.target.value })}>
            <option value="cuda">CUDA (GPU)</option>
            <option value="cpu">CPU</option>
            <option value="mps">MPS (Apple Silicon)</option>
          </select>
          {!preflightOk ? (
            <div id="train-device-warning" className="train-device-warning">
              {preflightReason || 'Device preflight failed. Training is blocked.'}
            </div>
          ) : null}
          {!preflightOk && preflightAction === 'install_torch_cuda' ? (
            <div id="train-device-actions" style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
              <button id="train-install-btn" className="btn-sm" onClick={installCudaTorch}>
                Install CUDA PyTorch (Nightly)
              </button>
            </div>
          ) : null}
          <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Training Progress</span>
              <span id="train-progress-status" style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: running ? 'rgba(34,197,94,0.18)' : !preflightOk ? 'rgba(248,81,73,0.18)' : 'rgba(148,163,184,0.18)', color: running ? '#86efac' : !preflightOk ? '#fca5a5' : 'var(--text2)' }}>
                {running ? 'RUNNING' : !preflightOk ? 'BLOCKED' : 'IDLE'}
              </span>
            </div>
            <div className="usb-bus-bar-track">
              <div id="train-progress-fill" className="usb-bar-fill good" style={{ width: `${progress.progressPct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text2)', gap: 10, flexWrap: 'wrap' }}>
              <span>
                Step: {progress.currentStep !== null ? progress.currentStep.toLocaleString() : '--'} / {progress.currentStep !== null && progress.totalSteps !== null ? (progress.totalSteps ?? trainSteps).toLocaleString() : '--'}
              </span>
              <span>Loss: {progress.latestLoss !== null ? progress.latestLoss.toFixed(4) : '--'}</span>
              <span>ETA: {progress.etaText}</span>
            </div>
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 6, padding: 8, background: 'var(--bg3)' }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>Loss Trend</div>
              <div style={{ position: 'relative' }}>
                <canvas ref={lossCanvasRef} id="train-loss-canvas" width={560} height={200} style={{ width: '100%', height: 200, display: 'block' }} />
                {progress.lossSeries.length === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 12 }}>
                    No data yet — loss values will appear here during training.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Training" disabled={!preflightOk || (source === 'local' && localRepoId === '__none__')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Checkpoints</h3>
              <button className="btn-xs" onClick={refreshCheckpoints}>
                ↺ Refresh
              </button>
            </div>
            <div id="train-checkpoints-list" className="device-list">
              {checkpointsLoading ? (
              checkpointsTimedOut ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted" style={{ color: 'var(--red)' }}>Failed to load checkpoints</span>
                  <button className="btn-xs" onClick={refreshCheckpoints}>Retry</button>
                </div>
              ) : (
                <div className="muted">Loading checkpoints...</div>
              )
            ) : null}
              {!checkpointsLoading && checkpoints.length === 0 ? <div className="muted">No checkpoints found. Train a model first.</div> : null}
              {!checkpointsLoading && checkpoints.length > 0
                ? checkpoints.map((cp) => (
                    <div key={cp.path} style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg3)', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{cp.display ?? cp.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{cp.path}</div>
                    </div>
                  ))
                : null}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>GPU Status</h3>
              <button onClick={refreshGpu} className="btn-xs">
                ↺ Refresh
              </button>
            </div>
            <div id="train-gpu-status" className="device-list">
              {!gpuStatus ? (
                gpuTimedOut ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="muted" style={{ color: 'var(--red)' }}>Failed to load GPU info</span>
                    <button className="btn-xs" onClick={refreshGpu}>Retry</button>
                  </div>
                ) : (
                  <div className="muted">Loading GPU info...</div>
                )
              ) : null}
              {gpuStatus && !gpuStatus.exists ? <div className="muted">NVIDIA GPU info unavailable: {gpuStatus.error ?? 'Check nvidia-smi'}</div> : null}
              {gpuStatus?.exists ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GPU Utilization</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{Math.round(gpuStatus.utilization ?? 0)}%</span>
                  </div>
                  <div className="usb-bus-bar-track">
                    <div
                      className={`usb-bar-fill ${(gpuStatus.utilization ?? 0) > 80 ? 'danger' : (gpuStatus.utilization ?? 0) > 50 ? 'warn' : 'good'}`}
                      style={{ width: `${Math.max(0, Math.min(100, gpuStatus.utilization ?? 0))}%` }}
                    />
                  </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span>VRAM Usage</span>
                    <span style={{ fontFamily: 'var(--mono)' }}>
                      {Math.round(gpuStatus.memory_used ?? 0)}MB / {Math.round(gpuStatus.memory_total ?? 0)}MB
                    </span>
                  </div>
                  <div className="usb-bus-bar-track">
                    <div
                      className={`usb-bar-fill ${(gpuStatus.memory_percent ?? 0) > 85 ? 'danger' : (gpuStatus.memory_percent ?? 0) > 70 ? 'warn' : 'good'}`}
                      style={{ width: `${Math.max(0, Math.min(100, gpuStatus.memory_percent ?? 0))}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
