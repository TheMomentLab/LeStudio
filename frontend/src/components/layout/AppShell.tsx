import type { ReactNode } from 'react'
import { useLeStudioStore } from '../../store'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  children: ReactNode
  wsConnected: boolean
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

const tabs = [
  { id: 'status', label: 'Status' },
  { id: 'teleop', label: 'Teleop' },
  { id: 'record', label: 'Record' },
  { id: 'dataset', label: 'Dataset' },
  { id: 'calibrate', label: 'Calibration' },
  { id: 'motor-setup', label: 'Motor Setup' },
  { id: 'device-setup', label: 'Mapping' },
  { id: 'train', label: 'Train' },
  { id: 'eval', label: 'Eval' },
]

export function AppShell({ children, wsConnected, theme, onToggleTheme }: AppShellProps) {
  const mobileSidebarOpen = useLeStudioStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useLeStudioStore((s) => s.setMobileSidebarOpen)

  return (
    <div id="app" className={mobileSidebarOpen ? 'sidebar-open' : ''}>
      <header>
        <div className="header-left">
          <button
            id="sidebar-menu-btn"
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          >
            ☰
          </button>
          <img src="/static/logo.svg" alt="LeStudio Logo" className="logo" style={{ width: 32, height: 32 }} />
          <h1>
            LeRobot <span style={{ color: 'var(--text2)', fontWeight: 400 }}>Studio</span>
          </h1>
          <span className="beta-badge">BETA</span>
        </div>
        <div className="header-right">
          <button id="theme-toggle-btn" className="btn-xs" onClick={onToggleTheme}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <div id="ws-status" className="ws-status" aria-live="polite">
            <span id="ws-dot" className={`dot ${wsConnected ? 'green' : 'red'}`} />
            <span id="ws-label">{wsConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </header>
      <div className="workbench-shell">
        <Sidebar tabs={tabs} />
        <div id="sidebar-backdrop" aria-hidden="true" onClick={() => setMobileSidebarOpen(false)} />
        <main>{children}</main>
      </div>
    </div>
  )
}
