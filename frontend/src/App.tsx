import { useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { ToastLayer } from './components/shared/Toast'
import { useConfig } from './hooks/useConfig'
import { useMappedCameras } from './hooks/useMappedCameras'
import { useWebSocket } from './hooks/useWebSocket'
import { CalibrateTab } from './tabs/CalibrateTab'
import { DatasetTab } from './tabs/DatasetTab'
import { DeviceSetupTab } from './tabs/DeviceSetupTab'
import { EvalTab } from './tabs/EvalTab'
import { MotorSetupTab } from './tabs/MotorSetupTab'
import { RecordTab } from './tabs/RecordTab'
import { StatusTab } from './tabs/StatusTab'
import { TeleopTab } from './tabs/TeleopTab'
import { TrainTab } from './tabs/TrainTab'
import { apiGet } from './lib/api'
import { useLeStudioStore } from './store'

type ThemeMode = 'dark' | 'light'

function App() {
  const activeTab = useLeStudioStore((s) => s.activeTab)
  const setActiveTab = useLeStudioStore((s) => s.setActiveTab)
  const uiMode = useLeStudioStore((s) => s.uiMode)
  const setUiMode = useLeStudioStore((s) => s.setUiMode)
  const wsReady = useLeStudioStore((s) => s.wsReady)
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

    const savedMode = localStorage.getItem('lestudio.ui-mode')
    setUiMode(savedMode === 'advanced' ? 'advanced' : 'guided')

    loadConfig()
    refreshDevices()
    apiGet<{ huggingface_cli?: boolean }>('/api/deps/status')
      .then((res) => {
        setSidebarSignals({ datasetMissingDep: !res.huggingface_cli })
      })
      .catch(() => undefined)
  }, [loadConfig, refreshDevices, setSidebarSignals, setUiMode])

  useEffect(() => {
    if (uiMode !== 'guided') return
    if (activeTab === 'dataset' || activeTab === 'train' || activeTab === 'eval') {
      setActiveTab('status')
    }
  }, [activeTab, setActiveTab, uiMode])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toUpperCase() ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      const st = useLeStudioStore.getState()
      if (e.code === 'Space') {
        if (st.activeTab === 'teleop') {
          e.preventDefault()
          const button = document.querySelector('#tab-teleop .btn-row button') as HTMLButtonElement | null
          button?.click()
        }
        if (st.activeTab === 'record') {
          e.preventDefault()
          const button = document.querySelector('#tab-record .btn-row button') as HTMLButtonElement | null
          button?.click()
        }
      }
      if (st.activeTab === 'record' && st.procStatus.record) {
        if (e.code === 'ArrowRight') {
          e.preventDefault()
          ;(document.querySelector('#tab-record .record-ep-action') as HTMLButtonElement | null)?.click()
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault()
          ;(document.querySelector('#tab-record .record-ep-discard') as HTMLButtonElement | null)?.click()
        } else if (e.code === 'Escape') {
          e.preventDefault()
          ;(document.querySelector('#tab-record .record-ep-end') as HTMLButtonElement | null)?.click()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('lestudio-theme', next)
  }

  useEffect(() => {
    localStorage.setItem('lestudio.ui-mode', uiMode)
  }, [uiMode])

  const renderTabs = useMemo(
    () => (
      <>
        <StatusTab active={activeTab === 'status'} />
        <TeleopTab active={activeTab === 'teleop'} />
        <RecordTab active={activeTab === 'record'} />
        <DatasetTab active={activeTab === 'dataset'} />
        <CalibrateTab active={activeTab === 'calibrate'} />
        <MotorSetupTab active={activeTab === 'motor-setup'} />
        <DeviceSetupTab active={activeTab === 'device-setup'} />
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
