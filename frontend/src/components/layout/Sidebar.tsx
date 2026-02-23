import { useLeStudioStore } from '../../store'

const PROCESS_TABS: Record<string, string> = {
  teleop: 'teleop',
  record: 'record',
  calibrate: 'calibrate',
  'motor-setup': 'motor_setup',
  train: 'train',
  eval: 'eval',
}

const TAB_GROUPS = [
  {
    id: 'setup',
    title: 'Setup',
    tabs: [
      { id: 'status', label: 'Status', icon: '📊' },
      { id: 'device-setup', label: 'Mapping', icon: '🔌' },
      { id: 'motor-setup', label: 'Motor Setup', icon: '⚙️' },
      { id: 'calibrate', label: 'Calibration', icon: '🎯' },
    ],
  },
  {
    id: 'operate',
    title: 'Operate',
    tabs: [
      { id: 'teleop', label: 'Teleop', icon: '🎮' },
      { id: 'record', label: 'Record', icon: '🔴' },
    ],
  },
  {
    id: 'data',
    title: 'Data',
    tabs: [{ id: 'dataset', label: 'Dataset', icon: '📁' }],
  },
  {
    id: 'ml',
    title: 'ML',
    tabs: [
      { id: 'train', label: 'Train', icon: '🧠' },
      { id: 'eval', label: 'Eval', icon: '📈' },
    ],
  },
]

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
  if (state === 'error') return 'Error'
  if (state === 'needs_root') return 'Needs Root'
  if (state === 'needs_udev') return 'Setup Needed'
  if (state === 'missing_dep') return 'Install Needed'
  if (state === 'needs_device') return 'No Device'
  return ''
}


export function Sidebar() {
  const activeTab = useLeStudioStore((s) => s.activeTab)
  const setActiveTab = useLeStudioStore((s) => s.setActiveTab)
  const procStatus = useLeStudioStore((s) => s.procStatus)
  const signals = useLeStudioStore((s) => s.sidebarSignals)
  const setMobileSidebarOpen = useLeStudioStore((s) => s.setMobileSidebarOpen)

  return (
    <aside id="sidebar-nav" aria-label="Workflow Navigation" role="tablist" aria-orientation="vertical">
      {TAB_GROUPS.map((group) => (
        <div key={group.id} id={`sidebar-group-${group.id}`} className="sidebar-group">
          <div className="sidebar-group-title">{group.title}</div>
          {group.tabs.map((tab) => {
            const proc = PROCESS_TABS[tab.id]
            const running = proc ? !!procStatus[proc] : false
            const health = tabHealthState(tab.id, signals)
            const state = running ? 'running' : health
            const isActive = activeTab === tab.id
            const panelId = `tab-${tab.id}`
            const stateLabel = badgeLabel(state)

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`nav-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                className={`tab-btn ${isActive ? 'active' : ''} ${state ? `has-${state.replace('_', '-')}` : ''}`}
                onClick={() => {
                  setActiveTab(tab.id)
                  setMobileSidebarOpen(false)
                }}
                data-tab={tab.id}
                data-proc={proc ?? ''}
              >
                <span className="tab-icon">{tab.icon}</span><span className="tab-text">{tab.label}</span>
                {stateLabel ? (
                  <span className="tab-state-badge" aria-label={stateLabel}>
                    {stateLabel}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
