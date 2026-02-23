import { useEffect, useState } from 'react'
import { LogConsole } from '../components/shared/LogConsole'
import { ProcessButtons } from '../components/shared/ProcessButtons'
import { useProcess } from '../hooks/useProcess'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'

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

  useEffect(() => {
    if (!active) return
    apiGet('/api/robots').catch(() => undefined)
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
      <div className="two-col">
        <div className="card">
          <h3>Step 1: Connect Arm</h3>
          <label>Arm Role Type</label>
          <input value={type} onChange={(e) => setType(e.target.value)} />
          <label>Arm Port</label>
          <input value={port} onChange={(e) => setPort(e.target.value)} />
          <div className="info-box" style={{ marginTop: 12 }}>
            Run once for each arm to assign motor IDs and set baudrate.
          </div>
          <div className="spacer" />
          <ProcessButtons running={running} onStart={start} onStop={stop} startLabel="▶ Start Setup" />
        </div>
        <div className="card">
          <h3>Connected Arms</h3>
          <div className="device-list">
            {devices.arms.length === 0
              ? '—'
              : devices.arms.map((arm, idx) => (
                  <div className="device-item" key={`${arm.device ?? 'arm'}-${idx}`}>
                    <div>
                      <div className="dname">{arm.symlink ?? arm.device}</div>
                      <div className="dsub">{arm.path}</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
      <LogConsole processName="motor_setup" />
    </section>
  )
}
