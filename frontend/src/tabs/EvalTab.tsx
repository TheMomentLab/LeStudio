import { useEffect, useMemo, useState } from 'react'
import { LogConsole } from '../components/shared/LogConsole'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useConfig } from '../hooks/useConfig'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'

interface EvalTabProps {
  active: boolean
}

interface CheckpointItem {
  name: string
  path: string
  step?: number
}

export function EvalTab({ active }: EvalTabProps) {
  const running = useLeStudioStore((s) => !!s.procStatus.eval)
  const { config, buildConfig } = useConfig()
  const { stopProcess } = useProcess()
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const addToast = useLeStudioStore((s) => s.addToast)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])

  const doneEpisodes = useMemo(() => {
    const line = (useLeStudioStore.getState().logLines.eval ?? []).at(-1)?.text ?? ''
    const match = line.match(/episode\s*([0-9]+)\s*\/\s*([0-9]+)/i)
    return match ? Number(match[1]) : 0
  }, [useLeStudioStore((s) => s.logLines.eval)])

  const totalEpisodes = Number(config.eval_episodes ?? 10)
  const progressPct = Math.max(0, Math.min(100, totalEpisodes > 0 ? (doneEpisodes / totalEpisodes) * 100 : 0))

  const loadCheckpoints = async () => {
    const res = await apiGet<{ ok: boolean; checkpoints: CheckpointItem[] }>('/api/checkpoints')
    if (res.ok) setCheckpoints(res.checkpoints ?? [])
  }

  useEffect(() => {
    if (!active) return
    loadCheckpoints()
  }, [active])

  const start = async () => {
    const cfg = {
      eval_policy_path: (config.eval_policy_path as string) ?? 'outputs/train/checkpoints/last/pretrained_model',
      eval_repo_id: (config.eval_repo_id as string) ?? 'user/my-dataset',
      eval_episodes: Number(config.eval_episodes ?? 10),
      eval_device: (config.eval_device as string) ?? 'cuda',
      eval_task: (config.eval_task as string) ?? '',
    }
    if (!cfg.eval_policy_path) {
      appendLog('eval', '[ERROR] Policy path is required.', 'error')
      return
    }
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cfg.eval_repo_id)) {
      appendLog('eval', '[ERROR] Dataset Repo ID must be username/dataset format.', 'error')
      return
    }
    await buildConfig(cfg)
    const res = await apiPost<{ ok: boolean; error?: string }>('/api/eval/start', cfg)
    if (!res.ok) {
      appendLog('eval', `[ERROR] ${res.error ?? 'failed to start eval'}`, 'error')
      return
    }
    addToast('Eval started', 'success')
  }

  const stop = async () => {
    await stopProcess('eval')
    addToast('Eval stop requested', 'info')
  }

  return (
    <section id="tab-eval" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Evaluate Policy</h2>
      </div>
      <div className="two-col">
        <div className="card">
          <h3>Configuration</h3>
          <label>Checkpoint</label>
          <select
            value={(config.eval_policy_path as string) ?? ''}
            onChange={(e) => buildConfig({ eval_policy_path: e.target.value })}
            style={{ marginBottom: 12 }}
          >
            <option value="">(manual path below)</option>
            {checkpoints.map((cp) => (
              <option key={cp.path} value={cp.path}>
                {cp.step ? `${cp.name} (step ${cp.step.toLocaleString()})` : cp.name}
              </option>
            ))}
          </select>
          <label>Policy Path</label>
          <input value={(config.eval_policy_path as string) ?? 'outputs/train/checkpoints/last/pretrained_model'} onChange={(e) => buildConfig({ eval_policy_path: e.target.value })} />
          <label>Dataset Repo ID</label>
          <input value={(config.eval_repo_id as string) ?? 'user/my-dataset'} onChange={(e) => buildConfig({ eval_repo_id: e.target.value })} />
          <label>Episodes</label>
          <input type="number" min={1} value={totalEpisodes} onChange={(e) => buildConfig({ eval_episodes: Number(e.target.value) })} />
          <label>Compute Device</label>
          <select value={(config.eval_device as string) ?? 'cuda'} onChange={(e) => buildConfig({ eval_device: e.target.value })}>
            <option value="cuda">CUDA (GPU)</option>
            <option value="cpu">CPU</option>
            <option value="mps">MPS</option>
          </select>
          <label>Task (Optional)</label>
          <input value={(config.eval_task as string) ?? ''} onChange={(e) => buildConfig({ eval_task: e.target.value })} />

          <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Evaluation Progress</span>
              <span id="eval-progress-status" style={{ fontSize: 11, fontWeight: 700 }}>
                {running ? 'RUNNING' : 'IDLE'}
              </span>
            </div>
            <div className="usb-bus-bar-track">
              <div id="eval-progress-fill" className="usb-bar-fill good" style={{ width: `${progressPct}%` }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>
              Episodes: {doneEpisodes || '--'} / {totalEpisodes || '--'}
            </div>
          </div>
          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Eval" />
        </div>
      </div>
      <LogConsole processName="eval" />
    </section>
  )
}
