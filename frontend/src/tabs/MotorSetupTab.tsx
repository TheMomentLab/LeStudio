import { useEffect, useState } from 'react'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'
import type { RobotsResponse } from '../lib/types'

interface MotorSetupTabProps {
  active: boolean
}

export function MotorSetupTab({ active }: MotorSetupTabProps) {
  const running = useLeStudioStore((s) => !!s.procStatus.motor_setup)
  const devices = useLeStudioStore((s) => s.devices)
  const addToast = useLeStudioStore((s) => s.addToast)
  const appendLog = useLeStudioStore((s) => s.appendLog)
  const clearLog = useLeStudioStore((s) => s.clearLog)
  const { stopProcess } = useProcess()
  const [type, setType] = useState('so101_follower')
  const [port, setPort] = useState('/dev/follower_arm_1')
  const [armTypes, setArmTypes] = useState<string[]>(['so101_follower', 'so100_follower', 'so101_leader', 'so100_leader'])

  useEffect(() => {
    if (!active) return
    apiGet<RobotsResponse>('/api/robots').then((r) => {
      const types = r.types ?? ['so101_follower']
      if (types.length > 0) setArmTypes(types)
    })
  }, [active])

  const start = async () => {
    clearLog('motor_setup')
    if (!port.startsWith('/dev/')) {
      appendLog('motor_setup', '[ERROR] Port must start with /dev/', 'error')
      return
    }
    const res = await apiPost<{ ok: boolean; error?: string }>('/api/motor_setup/start', { robot_type: type, port })
    if (!res.ok) {
      appendLog('motor_setup', `[ERROR] ${res.error ?? 'failed to start motor setup'}`, 'error')
      return
    }
    addToast('Motor setup started', 'success')
  }

  const stop = async () => {
    await stopProcess('motor_setup')
    addToast('Motor setup stop requested', 'info')
  }

  return (
    <section id="tab-motor-setup" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Motor Setup</h2>
      </div>
      <div className="quick-guide">
        <h3>Motor Setup Guide</h3>
        <p>Assigns unique IDs to each servo motor. Run once per arm — results are saved permanently to the firmware. If the console asks for keyboard input, type in the <strong>global console drawer</strong> at the bottom. After setup, proceed to <strong>Calibration</strong>.</p>
      </div>
      <div className="two-col">
        <div className="card">
          <h3>Step 1: Connect Arm</h3>
          <label>Arm Role Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {armTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Setup" />
        </div>
        <div className="card">
          <h3>Connected Arms</h3>
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
      </div>
    </section>
  )
}
