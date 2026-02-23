import { useLeStudioStore } from '../../store'

const PROCESS_TABS: Record<string, string> = {
  teleop: 'teleop',
  record: 'record',
  calibrate: 'calibrate',
  'motor-setup': 'motor_setup',
  train: 'train',
  eval: 'eval',
}

function tabHealthState(tab: string, signals: ReturnType<typeof useLeStudioStore.getState>['sidebarSignals']): string {
  if (tab === 'device-setup') {
    if (signals.rulesNeedsRoot) return 'needs_root'
    if (signals.rulesNeedsInstall) return 'needs_udev'
    if (!signals.hasCameras || !signals.hasArms) return 'needs_device'
  }
  if (tab === 'dataset' && signals.datasetMissingDep) return 'missing_dep'
  if ((tab === 'train' || tab === 'eval') && signals.trainMissingDep) return 'missing_dep'
  return ''
}

function badgeLabel(state: string): string {
  if (state === 'running') return 'Running'
  if (state === 'needs_root') return 'Needs Root'
  if (state === 'needs_udev') return 'Setup Needed'
  if (state === 'missing_dep') return 'Install Needed'
  if (state === 'needs_device') return 'No Device'
  return ''
}

interface SidebarProps {
  tabs: { id: string; label: string }[]
}

export function Sidebar({ tabs }: SidebarProps) {
  const activeTab = useLeStudioStore((s) => s.activeTab)
  const setActiveTab = useLeStudioStore((s) => s.setActiveTab)
  const procStatus = useLeStudioStore((s) => s.procStatus)
  const uiMode = useLeStudioStore((s) => s.uiMode)
  const setUiMode = useLeStudioStore((s) => s.setUiMode)
  const signals = useLeStudioStore((s) => s.sidebarSignals)
  const setMobileSidebarOpen = useLeStudioStore((s) => s.setMobileSidebarOpen)

  return (
    <aside id="sidebar-nav" aria-label="Workflow Navigation">
      {tabs.map((tab) => {
        const proc = PROCESS_TABS[tab.id]
        const running = proc ? !!procStatus[proc] : false
        const health = tabHealthState(tab.id, signals)
        const state = running ? 'running' : health
        return (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${state ? `has-${state.replace('_', '-')}` : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              setMobileSidebarOpen(false)
            }}
            data-tab={tab.id}
            data-proc={proc ?? ''}
          >
            <span className="tab-text">{tab.label}</span>
            <span className="tab-state-badge">{badgeLabel(state)}</span>
          </button>
        )
      })}

      <div className="view-mode-toggle" style={{ marginTop: 12 }} title="UI mode">
        <button id="mode-guided-btn" className={`mode-btn ${uiMode === 'guided' ? 'active' : ''}`} type="button" onClick={() => setUiMode('guided')}>
          Guided
        </button>
        <button id="mode-advanced-btn" className={`mode-btn ${uiMode === 'advanced' ? 'active' : ''}`} type="button" onClick={() => setUiMode('advanced')}>
          Advanced
        </button>
      </div>
    </aside>
  )
}
