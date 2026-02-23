import { create } from 'zustand'
import type { DevicesResponse, LogLine, SidebarSignals, Toast, UiMode } from '../lib/types'

interface LeStudioState {
  activeTab: string
  config: Record<string, unknown>
  procStatus: Record<string, boolean>
  devices: DevicesResponse
  wsReady: boolean
  apiHealth: { resources: boolean; history: boolean }
  apiSupport: { resources: boolean; history: boolean }
  uiMode: UiMode
  logLines: Record<string, LogLine[]>
  toasts: Toast[]
  sidebarSignals: SidebarSignals
  mobileSidebarOpen: boolean
  setActiveTab: (tab: string) => void
  setConfig: (cfg: Record<string, unknown>) => void
  updateConfig: (partial: Record<string, unknown>) => void
  setProcStatus: (status: Record<string, boolean>) => void
  setDevices: (devices: DevicesResponse) => void
  setWsReady: (ready: boolean) => void
  setApiHealth: (key: string, val: boolean) => void
  setApiSupport: (key: string, val: boolean) => void
  setUiMode: (mode: UiMode) => void
  appendLog: (processName: string, text: string, kind: string) => void
  clearLog: (processName: string) => void
  addToast: (message: string, kind: string) => void
  removeToast: (id: string) => void
  setSidebarSignals: (signals: Partial<SidebarSignals>) => void
  setMobileSidebarOpen: (open: boolean) => void
}

const MAX_LOG_LINES = 1200

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

const defaultSignals: SidebarSignals = {
  rulesNeedsRoot: false,
  rulesNeedsInstall: false,
  hasCameras: true,
  hasArms: true,
  trainMissingDep: false,
  datasetMissingDep: false,
}

export const useLeStudioStore = create<LeStudioState>((set) => ({
  activeTab: 'status',
  config: {},
  procStatus: {},
  devices: { cameras: [], arms: [] },
  wsReady: false,
  apiHealth: { resources: true, history: true },
  apiSupport: { resources: true, history: true },
  uiMode: 'guided',
  logLines: {},
  toasts: [],
  sidebarSignals: defaultSignals,
  mobileSidebarOpen: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setConfig: (cfg) => set({ config: cfg }),
  updateConfig: (partial) => set((s) => ({ config: { ...s.config, ...partial } })),
  setProcStatus: (status) => set({ procStatus: status }),
  setDevices: (devices) => set({ devices }),
  setWsReady: (ready) => set({ wsReady: ready }),
  setApiHealth: (key, val) =>
    set((s) => ({ apiHealth: { ...s.apiHealth, [key]: val } as { resources: boolean; history: boolean } })),
  setApiSupport: (key, val) =>
    set((s) => ({
      apiSupport: { ...s.apiSupport, [key]: val } as { resources: boolean; history: boolean },
      apiHealth: val
        ? s.apiHealth
        : ({ ...s.apiHealth, [key]: true } as { resources: boolean; history: boolean }),
    })),
  setUiMode: (mode) => set({ uiMode: mode }),
  appendLog: (processName, text, kind) =>
    set((s) => {
      const prev = s.logLines[processName] ?? []
      const next = [...prev, { id: uid(), text, kind, ts: Date.now() }]
      return {
        logLines: {
          ...s.logLines,
          [processName]: next.slice(Math.max(0, next.length - MAX_LOG_LINES)),
        },
      }
    }),
  clearLog: (processName) => set((s) => ({ logLines: { ...s.logLines, [processName]: [] } })),
  addToast: (message, kind) =>
    set((s) => ({
      toasts: [...s.toasts, { id: uid(), message, kind: kind === 'error' ? 'error' : kind === 'info' ? 'info' : 'success' }],
    })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSidebarSignals: (signals) => set((s) => ({ sidebarSignals: { ...s.sidebarSignals, ...signals } })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}))

export type { LeStudioState }
