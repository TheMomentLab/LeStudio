import { useEffect, useMemo, useState } from 'react'
import { LogConsole } from '../components/shared/LogConsole'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useConfig } from '../hooks/useConfig'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import type { DatasetListItem } from '../lib/types'
import { useLeStudioStore } from '../store'

interface TrainTabProps {
  active: boolean
}

export function TrainTab({ active }: TrainTabProps) {
  const running = useLeStudioStore((s) => !!s.procStatus.train || !!s.procStatus.train_install)
  const { config, buildConfig } = useConfig()
  const { stopProcess, runPreflight } = useProcess()
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const addToast = useLeStudioStore((s) => s.addToast)
  const setSidebarSignals = useLeStudioStore((s) => s.setSidebarSignals)
  const [source, setSource] = useState<'local' | 'hf'>('local')
  const [datasets, setDatasets] = useState<DatasetListItem[]>([])
  const [gpuStatus, setGpuStatus] = useState<Record<string, unknown> | null>(null)
  const [preflightOk, setPreflightOk] = useState(true)

  const trainSteps = Number(config.train_steps ?? 100000)
  const currentStep = useMemo(() => {
    const logs = useLeStudioStore.getState().logLines.train ?? []
    const line = logs.at(-1)?.text ?? ''
    const match = line.match(/step:([0-9]+(?:\.[0-9]+)?[KMBTQ]?)/i)
    if (!match) return 0
    const token = match[1].toUpperCase()
    const unit = token.slice(-1)
    const value = Number(unit.match(/[KMBTQ]/) ? token.slice(0, -1) : token)
    if (!Number.isFinite(value)) return 0
    const mult = unit === 'K' ? 1_000 : unit === 'M' ? 1_000_000 : unit === 'B' ? 1_000_000_000 : 1
    return Math.floor(value * mult)
  }, [useLeStudioStore((s) => s.logLines.train)])

  const progressPct = Math.max(0, Math.min(100, trainSteps > 0 ? (currentStep / trainSteps) * 100 : 0))

  const refreshDatasets = async () => {
    const res = await apiGet<{ datasets: DatasetListItem[] }>('/api/datasets')
    setDatasets(res.datasets ?? [])
  }

  const refreshGpu = async () => {
    const res = await apiGet<Record<string, unknown>>('/api/gpu/status')
    setGpuStatus(res)
  }

  const refreshPreflight = async () => {
    const device = (config.train_device as string) ?? 'cuda'
    const res = await apiGet<{ ok: boolean; reason?: string }>(`/api/train/preflight?device=${encodeURIComponent(device)}`)
    setPreflightOk(!!res.ok)
    setSidebarSignals({ trainMissingDep: !res.ok })
    return !!res.ok
  }

  useEffect(() => {
    if (!active) return
    const nextSource = (config.train_dataset_source as string) === 'hf' ? 'hf' : 'local'
    setSource(nextSource)
    refreshDatasets()
    refreshGpu()
    refreshPreflight()
  }, [active])

  const repoId = source === 'local' ? datasets[0]?.id ?? 'user/my-dataset' : ((config.train_repo_id as string) ?? 'user/my-dataset')

  const start = async () => {
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

      <div className="two-col">
        <div className="card">
          <h3>Configuration</h3>
          <label>Policy Type</label>
          <select value={(config.train_policy as string) ?? 'act'} onChange={(e) => buildConfig({ train_policy: e.target.value })}>
            <option value="act">ACT</option>
            <option value="diffusion">Diffusion</option>
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
                {datasets.length === 0 ? <option value="__none__">No local datasets</option> : null}
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.id}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label>Dataset Repo ID</label>
              <input value={(config.train_repo_id as string) ?? 'user/my-dataset'} onChange={(e) => buildConfig({ train_repo_id: e.target.value })} />
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

          <label>Compute Device</label>
          <select value={(config.train_device as string) ?? 'cuda'} onChange={(e) => buildConfig({ train_device: e.target.value })}>
            <option value="cuda">CUDA (GPU)</option>
            <option value="cpu">CPU</option>
            <option value="mps">MPS</option>
          </select>
          {!preflightOk ? <div id="train-device-warning">Device preflight failed. Training is blocked.</div> : null}

          <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Training Progress</span>
              <span id="train-progress-status" style={{ fontSize: 11, fontWeight: 700 }}>
                {running ? 'RUNNING' : 'IDLE'}
              </span>
            </div>
            <div className="usb-bus-bar-track">
              <div id="train-progress-fill" className="usb-bar-fill good" style={{ width: `${progressPct}%` }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>Step: {currentStep.toLocaleString()} / {trainSteps.toLocaleString()}</div>
          </div>
          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Training" />
        </div>

        <div className="card">
          <h3>GPU Status</h3>
          <button onClick={refreshGpu} className="btn-xs">
            ↺ Refresh
          </button>
          <div id="train-gpu-status" className="device-list">
            {!gpuStatus ? <div className="muted">Loading GPU info...</div> : <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(gpuStatus, null, 2)}</pre>}
          </div>
        </div>
      </div>

      <LogConsole processName="train" />
    </section>
  )
}
