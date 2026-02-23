import { useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ToastLayer } from './components/shared/Toast'
import { useConfig } from './hooks/useConfig'
import { useMappedCameras } from './hooks/useMappedCameras'
import { useWebSocket } from './hooks/useWebSocket'
import { StatusTab } from './tabs/StatusTab'
import { TeleopTab } from './tabs/TeleopTab'
import { RecordTab } from './tabs/RecordTab'
import { CalibrateTab } from './tabs/CalibrateTab'
import { MotorSetupTab } from './tabs/MotorSetupTab'
import { DeviceSetupTab } from './tabs/DeviceSetupTab'
import { DatasetTab } from './tabs/DatasetTab'
import { TrainTab } from './tabs/TrainTab'
import { EvalTab } from './tabs/EvalTab'
import { apiGet } from './lib/api'
import { useLeStudioStore } from './store'

type ThemeMode = 'dark' | 'light'

function App() {
  const activeTab = useLeStudioStore((s) => s.activeTab)
  const wsReady = useLeStudioStore((s) => s.wsReady)
  const procStatus = useLeStudioStore((s) => s.procStatus)
  const uiMode = useLeStudioStore((s) => s.uiMode)
  const setUiMode = useLeStudioStore((s) => s.setUiMode)
  const setSidebarSignals = useLeStudioStore((s) => s.setSidebarSignals)
  const { loadConfig } = useConfig()
  const { refreshDevices } = useMappedCameras()
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useWebSocket()

  useEffect(() => {
    const savedTheme = (localStorage.getItem('lestudio-theme') as ThemeMode | null) ?? 'dark'
    const safeTheme = savedTheme === 'light' ? 'light' : 'dark'
    setTheme(safeTheme)
    document.documentElement.setAttribute('data-theme', safeTheme)
    loadConfig()
    refreshDevices()
    apiGet<{ huggingface_cli?: boolean }>('/api/deps/status')
      .then((res) => setSidebarSignals({ datasetMissingDep: !res.huggingface_cli }))
      .catch(() => undefined)
    apiGet<{ ok: boolean }>('/api/train/preflight?device=cuda')
      .then((res) => setSidebarSignals({ trainMissingDep: !res.ok }))
      .catch(() => setSidebarSignals({ trainMissingDep: true }))
  }, [loadConfig, refreshDevices, setSidebarSignals])

  /* keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = (target?.tagName ?? '').toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }

      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        setUiMode(uiMode === 'guided' ? 'advanced' : 'guided')
        return
      }

      if (e.code === 'Space') {
        if (activeTab === 'teleop') {
          e.preventDefault()
          ;(document.querySelector('#tab-teleop .btn-row button') as HTMLButtonElement | null)?.click()
          return
        }
        if (activeTab === 'record') {
          e.preventDefault()
          ;(document.querySelector('#tab-record #record-ep-controls button') as HTMLButtonElement | null)?.click()
          return
        }
      }

      if (activeTab === 'record' && procStatus.record) {
        if (e.code === 'ArrowRight') {
          e.preventDefault()
          ;(document.querySelector('#tab-record .record-ep-action') as HTMLButtonElement | null)?.click()
          return
        }
        if (e.code === 'ArrowLeft') {
          e.preventDefault()
          ;(document.querySelector('#tab-record .record-ep-discard') as HTMLButtonElement | null)?.click()
          return
        }
        if (e.code === 'Escape') {
          e.preventDefault()
          ;(document.querySelector('#tab-record .record-ep-end') as HTMLButtonElement | null)?.click()
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTab, procStatus.record, setUiMode, uiMode])

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('lestudio-theme', next)
  }

  const renderTabs = useMemo(
    () => (
      <>
        <StatusTab active={activeTab === 'status'} />
        <TeleopTab active={activeTab === 'teleop'} />
        <RecordTab active={activeTab === 'record'} />
        <CalibrateTab active={activeTab === 'calibrate'} />
        <MotorSetupTab active={activeTab === 'motor-setup'} />
        <DeviceSetupTab active={activeTab === 'device-setup'} />
        <DatasetTab active={activeTab === 'dataset'} />
        <TrainTab active={activeTab === 'train'} />
        <EvalTab active={activeTab === 'eval'} />
      </>
    ),
    [activeTab],
  )

  return (
    <>
      <AppShell wsConnected={wsReady} theme={theme} onToggleTheme={toggleTheme}>
        {renderTabs}
      </AppShell>
      <ToastLayer />
    </>
  )
}

export default App
