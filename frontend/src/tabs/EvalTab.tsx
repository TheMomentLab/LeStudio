import { useEffect, useMemo, useRef, useState } from 'react'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useConfig } from '../hooks/useConfig'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'

import type { LogLine } from '../lib/types'

const EMPTY_EVAL_LINES: LogLine[] = []

interface EvalTabProps {
  active: boolean
}

interface CheckpointItem {
  name: string
  path: string
  step?: number
}

type EvalProgressStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'completed' | 'error'

interface EpisodeReward {
  ep: number
  reward: number
}

const COMPLETE_MARKER = /evaluation complete|end of evaluation|eval complete/i
const END_MARKER = /\[eval process ended\]/i
const ERROR_MARKER = /\[ERROR\]|Traceback|RuntimeError|Exception|failed/i

function formatReward(value: number | null) {
  return Number.isFinite(value) ? Number(value).toFixed(4) : '--'
}

function formatSuccess(value: number | null) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}%` : '--'
}

function formatClock(ms: number | null) {
  if (!ms) return '--'
  return new Date(ms).toLocaleTimeString()
}

function formatElapsed(startedAtMs: number | null, endedAtMs: number | null, tick: number) {
  if (!startedAtMs) return '--'
  const endMs = endedAtMs ?? Date.now()
  void tick
  const sec = Math.max(0, Math.floor((endMs - startedAtMs) / 1000))
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function parseSuccess(rawValue: string) {
  const raw = Number(rawValue)
  if (!Number.isFinite(raw)) return null
  return raw > 1 ? Math.min(100, raw) : Math.max(0, raw * 100)
}

export function EvalTab({ active }: EvalTabProps) {
  const running = useLeStudioStore((s) => !!s.procStatus.eval)
  const evalLogLines = useLeStudioStore((s) => s.logLines.eval ?? EMPTY_EVAL_LINES)
  const { config, buildConfig } = useConfig()
  const { stopProcess } = useProcess()
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const addToast = useLeStudioStore((s) => s.addToast)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [progressStatus, setProgressStatus] = useState<EvalProgressStatus>('idle')
  const [doneEpisodes, setDoneEpisodes] = useState(0)
  const [targetEpisodes, setTargetEpisodes] = useState<number | null>(null)
  const [meanReward, setMeanReward] = useState<number | null>(null)
  const [successRate, setSuccessRate] = useState<number | null>(null)
  const [finalReward, setFinalReward] = useState<number | null>(null)
  const [finalSuccess, setFinalSuccess] = useState<number | null>(null)
  const [bestEpisode, setBestEpisode] = useState<EpisodeReward | null>(null)
  const [worstEpisode, setWorstEpisode] = useState<EpisodeReward | null>(null)
  const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
  const [endedAtMs, setEndedAtMs] = useState<number | null>(null)
  const [hadError, setHadError] = useState(false)
  const [elapsedTick, setElapsedTick] = useState(0)
  const processedLogsRef = useRef(0)
  const perEpisodeRewardRef = useRef<Record<number, number>>({})

  const totalEpisodes = Number(config.eval_episodes ?? 10)
  const progressTotal = targetEpisodes && targetEpisodes > 0 ? targetEpisodes : null
  const progressPct = Math.max(0, Math.min(100, progressTotal ? (doneEpisodes / progressTotal) * 100 : 0))

  const progressStatusStyle = useMemo(() => {
    const map: Record<EvalProgressStatus, { label: string; bg: string; color: string }> = {
      idle: { label: 'IDLE', bg: 'rgba(148,163,184,0.18)', color: 'var(--text2)' },
      starting: { label: 'STARTING', bg: 'rgba(59,130,246,0.18)', color: '#93c5fd' },
      running: { label: 'RUNNING', bg: 'rgba(34,197,94,0.18)', color: '#86efac' },
      stopped: { label: 'STOPPED', bg: 'rgba(148,163,184,0.18)', color: 'var(--text2)' },
      completed: { label: 'COMPLETED', bg: 'rgba(16,185,129,0.20)', color: '#6ee7b7' },
      error: { label: 'ERROR', bg: 'rgba(248,81,73,0.20)', color: '#fca5a5' },
    }
    return map[progressStatus]
  }, [progressStatus])

  const recomputeBestWorst = () => {
    const entries = Object.entries(perEpisodeRewardRef.current)
      .map(([ep, reward]) => ({ ep: Number(ep), reward: Number(reward) }))
      .filter((v) => Number.isFinite(v.ep) && Number.isFinite(v.reward))
    if (!entries.length) {
      setBestEpisode(null)
      setWorstEpisode(null)
      return
    }
    entries.sort((a, b) => a.reward - b.reward)
    setWorstEpisode(entries[0])
    setBestEpisode(entries[entries.length - 1])
  }

  const resetEvalState = (status: EvalProgressStatus) => {
    setProgressStatus(status)
    setDoneEpisodes(0)
    setMeanReward(null)
    setSuccessRate(null)
    setFinalReward(null)
    setFinalSuccess(null)
    setBestEpisode(null)
    setWorstEpisode(null)
    setHadError(false)
    setStartedAtMs(null)
    setEndedAtMs(null)
    perEpisodeRewardRef.current = {}
  }

  const loadCheckpoints = async () => {
    const res = await apiGet<{ ok: boolean; checkpoints: CheckpointItem[] }>('/api/checkpoints')
    if (res.ok) setCheckpoints(res.checkpoints ?? [])
  }

  useEffect(() => {
    if (!active) return
    loadCheckpoints()
  }, [active])

  useEffect(() => {
    if (!startedAtMs || endedAtMs) return
    const timer = window.setInterval(() => setElapsedTick((t) => t + 1), 1000)
    return () => window.clearInterval(timer)
  }, [startedAtMs, endedAtMs])

  useEffect(() => {
    if (evalLogLines.length < processedLogsRef.current) {
      processedLogsRef.current = 0
    }
    const nextLines = evalLogLines.slice(processedLogsRef.current)
    if (!nextLines.length) return

    for (const lineItem of nextLines) {
      const line = lineItem.text ?? ''
      if (!line) continue

      if (lineItem.kind === 'error' || ERROR_MARKER.test(line)) {
        setHadError(true)
        setProgressStatus('error')
      }

      const epTotalMatch = line.match(/(?:^|\s)(?:n_episodes|episodes)\s*[:=]\s*([0-9]+)/i)
        || line.match(/episode\s*\d+\s*\/\s*([0-9]+)/i)
        || line.match(/completed\s*episodes\s*[:=]\s*\d+\s*\/\s*([0-9]+)/i)
      if (epTotalMatch) {
        const total = parseInt(epTotalMatch[1], 10)
        if (Number.isFinite(total) && total > 0) setTargetEpisodes(total)
      }

      const doneMatch = line.match(/episode\s*([0-9]+)\s*\/\s*([0-9]+)/i)
        || line.match(/completed\s*episodes\s*[:=]\s*([0-9]+)\s*\/\s*([0-9]+)/i)
        || line.match(/\bepisode\s*[:#]\s*([0-9]+)\b/i)
      if (doneMatch) {
        const done = parseInt(doneMatch[1], 10)
        if (Number.isFinite(done) && done >= 0) {
          setDoneEpisodes((prev) => Math.max(prev, done))
          if (!hadError) setProgressStatus('running')
        }
        if (doneMatch[2]) {
          const total = parseInt(doneMatch[2], 10)
          if (Number.isFinite(total) && total > 0) setTargetEpisodes(total)
        }
      }

      const successMatch = line.match(/\bsuccess(?:[_\s-]?rate)?\s*[:=]\s*([0-9]*\.?[0-9]+)\s*%?/i)
      if (successMatch) {
        const parsed = parseSuccess(successMatch[1])
        if (parsed !== null) setSuccessRate(parsed)
      }

      const rewardMatch = line.match(/\b(?:mean[_\s-]?reward|avg[_\s-]?reward|episode[_\s-]?reward)\s*[:=]\s*([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)/i)
      if (rewardMatch) {
        const reward = Number(rewardMatch[1])
        if (Number.isFinite(reward)) {
          setMeanReward(reward)
          const epForReward = line.match(/episode\s*([0-9]+)\b/i)
          if (epForReward) {
            const epIdx = parseInt(epForReward[1], 10)
            if (Number.isFinite(epIdx)) {
              perEpisodeRewardRef.current[epIdx] = reward
              recomputeBestWorst()
            }
          }
        }
      }

      const finalRewardMatch = line.match(/(?:final|overall|eval)\s*(?:mean[_\s-]?reward|avg[_\s-]?reward|reward)\s*[:=]\s*([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)/i)
      if (finalRewardMatch) {
        const value = Number(finalRewardMatch[1])
        if (Number.isFinite(value)) setFinalReward(value)
      }

      const finalSuccessMatch = line.match(/(?:final|overall|eval)\s*(?:success(?:[_\s-]?rate)?)\s*[:=]\s*([0-9]*\.?[0-9]+)\s*%?/i)
      if (finalSuccessMatch) {
        const parsed = parseSuccess(finalSuccessMatch[1])
        if (parsed !== null) setFinalSuccess(parsed)
      }

      if (COMPLETE_MARKER.test(line)) {
        setProgressStatus((prev) => (prev === 'error' ? 'error' : 'completed'))
        setEndedAtMs((prev) => prev ?? lineItem.ts ?? Date.now())
        setFinalReward((prev) => (Number.isFinite(prev) ? prev : meanReward))
        setFinalSuccess((prev) => (Number.isFinite(prev) ? prev : successRate))
      }

      if (END_MARKER.test(line)) {
        setEndedAtMs((prev) => prev ?? lineItem.ts ?? Date.now())
        setProgressStatus((prev) => {
          if (prev === 'error') return 'error'
          if (targetEpisodes && doneEpisodes >= targetEpisodes) return 'completed'
          return 'stopped'
        })
      }
    }

    processedLogsRef.current = evalLogLines.length
  }, [doneEpisodes, evalLogLines, hadError, meanReward, successRate, targetEpisodes])

  useEffect(() => {
    if (running) {
      setStartedAtMs((prev) => prev ?? Date.now())
      setEndedAtMs(null)
      setProgressStatus((prev) => (prev === 'starting' || prev === 'error' || prev === 'completed' ? prev : 'running'))
      return
    }
    if (!running && startedAtMs && !endedAtMs) {
      setEndedAtMs(Date.now())
      setProgressStatus((prev) => {
        if (prev === 'completed' || prev === 'error') return prev
        return doneEpisodes > 0 ? 'stopped' : 'idle'
      })
    }
  }, [running, startedAtMs, endedAtMs, doneEpisodes])

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
    resetEvalState('starting')
    setStartedAtMs(Date.now())
    setTargetEpisodes(cfg.eval_episodes)
    processedLogsRef.current = evalLogLines.length
    await buildConfig(cfg)
    const res = await apiPost<{ ok: boolean; error?: string }>('/api/eval/start', cfg)
    if (!res.ok) {
      appendLog('eval', `[ERROR] ${res.error ?? 'failed to start eval'}`, 'error')
      setHadError(true)
      setProgressStatus('error')
      setEndedAtMs(Date.now())
      return
    }
    setProgressStatus('running')
    addToast('Eval started', 'success')
  }

  const stop = async () => {
    await stopProcess('eval')
    setEndedAtMs(Date.now())
    setProgressStatus((prev) => (prev === 'error' ? 'error' : doneEpisodes > 0 ? 'stopped' : 'idle'))
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
          <input
            type="text"
            value={(config.eval_policy_path as string) ?? 'outputs/train/checkpoints/last/pretrained_model'}
            placeholder="Path to trained policy/checkpoint"
            onChange={(e) => buildConfig({ eval_policy_path: e.target.value })}
          />
          <label>Dataset Repo ID</label>
          <input
            type="text"
            value={(config.eval_repo_id as string) ?? 'user/my-dataset'}
            placeholder="username/dataset"
            onChange={(e) => buildConfig({ eval_repo_id: e.target.value })}
          />
          <label>Episodes</label>
          <input type="number" min={1} value={totalEpisodes} onChange={(e) => buildConfig({ eval_episodes: Number(e.target.value) })} />
          <label>Compute Device</label>
          <select value={(config.eval_device as string) ?? 'cuda'} onChange={(e) => buildConfig({ eval_device: e.target.value })}>
            <option value="cuda">CUDA (GPU)</option>
            <option value="cpu">CPU</option>
            <option value="mps">MPS (Apple Silicon)</option>
          </select>
          <label>Task (Optional)</label>
          <input
            type="text"
            value={(config.eval_task as string) ?? ''}
            placeholder="Optional env task override"
            onChange={(e) => buildConfig({ eval_task: e.target.value })}
          />

          <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Evaluation Progress</span>
              <span
                id="eval-progress-status"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: progressStatusStyle.bg,
                  color: progressStatusStyle.color,
                }}
              >
                {progressStatusStyle.label}
              </span>
            </div>
            <div className="usb-bus-bar-track">
              <div id="eval-progress-fill" className="usb-bar-fill good" style={{ width: `${progressPct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text2)', gap: 10, flexWrap: 'wrap' }}>
              <span id="eval-progress-episodes">Episodes: {doneEpisodes || '--'} / {progressTotal || '--'}</span>
              <span id="eval-progress-reward">Reward: {formatReward(meanReward)}</span>
              <span id="eval-progress-success">Success: {formatSuccess(successRate)}</span>
            </div>
          </div>

          <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>Evaluation Summary</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 11, color: 'var(--text2)' }}>
              <span id="eval-summary-confidence" className="dbadge" style={{ display: 'none' }} />
              <span id="eval-summary-time">
                Start {formatClock(startedAtMs)} · Elapsed {formatElapsed(startedAtMs, endedAtMs, elapsedTick)} · End {formatClock(endedAtMs)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
              <div id="eval-summary-final-reward">Final Reward: {formatReward(finalReward)}</div>
              <div id="eval-summary-final-success">Final Success: {formatSuccess(finalSuccess)}</div>
              <div id="eval-summary-best">
                Best Episode: {bestEpisode ? `#${bestEpisode.ep} (${bestEpisode.reward.toFixed(4)})` : '--'}
              </div>
              <div id="eval-summary-worst">
                Worst Episode: {worstEpisode ? `#${worstEpisode.ep} (${worstEpisode.reward.toFixed(4)})` : '--'}
              </div>
            </div>
          </div>

          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Eval" />
        </div>
        <div className="card">
          <h3>Notes</h3>
          <ul style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 20, marginTop: 8, lineHeight: 1.5 }}>
            <li>Use a trained checkpoint path from your training output directory.</li>
            <li>If CUDA is unavailable, switch Eval device to CPU or MPS.</li>
            <li>Eval logs and metrics are available in the global console drawer.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
