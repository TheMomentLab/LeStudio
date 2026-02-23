import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'

interface DeviceSetupTabProps {
  active: boolean
}

export function DeviceSetupTab({ active }: DeviceSetupTabProps) {
  const devices = useLeStudioStore((s) => s.devices)
  const setDevices = useLeStudioStore((s) => s.setDevices)
  const addToast = useLeStudioStore((s) => s.addToast)
  const setSidebarSignals = useLeStudioStore((s) => s.setSidebarSignals)
  const [rulesStatus, setRulesStatus] = useState<{ rules_installed?: boolean; needs_root_for_install?: boolean; sudo_noninteractive?: boolean } | null>(null)
  const [cameraAssignments, setCameraAssignments] = useState<Record<string, string>>({})
  const [armAssignments, setArmAssignments] = useState<Record<string, string>>({})

  const refresh = async () => {
    const data = await apiGet<{ cameras: Array<Record<string, string>>; arms: Array<Record<string, string>> }>('/api/devices')
    setDevices({ cameras: data.cameras ?? [], arms: data.arms ?? [] })
    const rs = await apiGet<{ rules_installed: boolean; needs_root_for_install: boolean; sudo_noninteractive: boolean }>('/api/rules/status')
    setRulesStatus(rs)
    setSidebarSignals({
      rulesNeedsInstall: !rs.rules_installed,
      rulesNeedsRoot: rs.needs_root_for_install,
      hasCameras: (data.cameras ?? []).length > 0,
      hasArms: (data.arms ?? []).length > 0,
    })
    const nextCameraMap: Record<string, string> = {}
    ;(data.cameras ?? []).forEach((camera) => {
      const kernels = camera.kernels ?? ''
      if (kernels) nextCameraMap[kernels] = camera.symlink ?? '(none)'
    })
    setCameraAssignments(nextCameraMap)

    const nextArmMap: Record<string, string> = {}
    ;(data.arms ?? []).forEach((arm) => {
      const serial = arm.serial ?? ''
      if (serial) nextArmMap[serial] = arm.symlink ?? '(none)'
    })
    setArmAssignments(nextArmMap)
  }

  useEffect(() => {
    if (!active) return
    refresh()
  }, [active])

  const hasDuplicate = useMemo(() => {
    const cameraRoles = Object.values(cameraAssignments).filter((v) => v && v !== '(none)')
    const armRoles = Object.values(armAssignments).filter((v) => v && v !== '(none)')
    return new Set(cameraRoles).size !== cameraRoles.length || new Set(armRoles).size !== armRoles.length
  }, [cameraAssignments, armAssignments])

  const apply = async () => {
    if (hasDuplicate) {
      addToast('Fix duplicate assignments first', 'error')
      return
    }
    const res = await apiPost<{ ok: boolean; error?: string }>('/api/rules/apply', {
      assignments: cameraAssignments,
      arm_assignments: armAssignments,
    })
    if (!res.ok) {
      addToast(`Failed to apply mapping: ${res.error ?? 'unknown error'}`, 'error')
      return
    }
    addToast('Mapping rules applied', 'success')
    await refresh()
  }

  return (
    <section id="tab-device-setup" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Device Mapping</h2>
        <button onClick={refresh} className="btn-sm">
          ↺ Refresh
        </button>
      </div>

      <div className="card" id="rules-card">
        <h3>udev Rules</h3>
        <div id="rules-install-status">
          {rulesStatus ? (
            rulesStatus.rules_installed ? (
              <span>✓ udev rules installed</span>
            ) : rulesStatus.needs_root_for_install ? (
              <span>⚠ rules not installed. Run `lestudio install-udev` as root.</span>
            ) : (
              <span>⏳ installing udev rules…</span>
            )
          ) : (
            'Checking udev install status...'
          )}
        </div>
      </div>

      <div className="card">
        <h3>Camera Mapping</h3>
        <div id="device-cameras-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {devices.cameras.length === 0
            ? 'Loading…'
            : devices.cameras.map((camera, idx) => (
                <div className="cam-card" key={`${camera.device ?? 'cam'}-${idx}`}>
                  <div className="cam-preview-wrap">
                    <div className="play-hint">Preview disabled in React rewrite</div>
                  </div>
                  <div className="cam-info">
                    <div className="cam-name">/dev/{camera.device ?? '?'}</div>
                    <div className="cam-meta">Port: {camera.kernels ?? '?'}</div>
                    <select
                      value={cameraAssignments[camera.kernels ?? ''] ?? '(none)'}
                      onChange={(e) => {
                        const key = camera.kernels ?? ''
                        if (!key) return
                        setCameraAssignments((prev) => ({ ...prev, [key]: e.target.value }))
                      }}
                    >
                      <option value="(none)">Not used</option>
                      <option value="top_cam_1">Top Camera 1</option>
                      <option value="top_cam_2">Top Camera 2</option>
                      <option value="top_cam_3">Top Camera 3</option>
                      <option value="wrist_cam_1">Wrist Camera 1</option>
                      <option value="wrist_cam_2">Wrist Camera 2</option>
                    </select>
                  </div>
                </div>
              ))}
        </div>
      </div>

      <div className="card">
        <h3>Arm Port Mapping</h3>
        <div id="device-arms-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {devices.arms.length === 0
            ? 'Loading…'
            : devices.arms.map((arm, idx) => (
                <div className="arm-card" key={`${arm.device ?? 'arm'}-${idx}`}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>/dev/{arm.device ?? '?'}</div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                    Serial: <code>{arm.serial ?? 'N/A'}</code>
                  </div>
                  <select
                    disabled={!arm.serial}
                    value={(arm.serial && armAssignments[arm.serial]) ?? '(none)'}
                    onChange={(e) => {
                      if (!arm.serial) return
                      setArmAssignments((prev) => ({ ...prev, [arm.serial as string]: e.target.value }))
                    }}
                  >
                    <option value="(none)">Not used</option>
                    <option value="follower_arm_1">Follower Arm 1</option>
                    <option value="follower_arm_2">Follower Arm 2</option>
                    <option value="leader_arm_1">Leader Arm 1</option>
                    <option value="leader_arm_2">Leader Arm 2</option>
                  </select>
                </div>
              ))}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn-primary" onClick={apply}>
            Apply Mapping
          </button>
        </div>
      </div>
    </section>
  )
}
