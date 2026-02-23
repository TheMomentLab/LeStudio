import { useCallback } from 'react'
import { apiPost } from '../lib/api'
import type { PreflightResponse } from '../lib/types'
import { useLeStudioStore } from '../store'

export const useProcess = () => {
  const appendLog = useLeStudioStore((s) => s.appendLog)

  const runPreflight = useCallback(
    async (cfg: Record<string, unknown>, processName: string) => {
      const res = await apiPost<PreflightResponse>('/api/preflight', cfg)
      const checks = Array.isArray(res.checks) ? res.checks : []
      checks.forEach((c) => {
        const icon = c.status === 'ok' ? 'OK' : c.status === 'warn' ? 'WARN' : 'ERROR'
        const kind = c.status === 'error' ? 'error' : c.status === 'warn' ? 'info' : 'stdout'
        appendLog(processName, `[${icon}] ${c.label}: ${c.msg}`, kind)
      })
      if (!res.ok) {
        appendLog(processName, '[ERROR] Preflight failed. Fix errors before starting.', 'error')
        return false
      }
      appendLog(processName, checks.some((c) => c.status === 'warn') ? '[INFO] Preflight passed with warnings.' : '[INFO] Preflight passed.', 'info')
      return true
    },
    [appendLog],
  )

  const sendProcessInput = useCallback(async (processName: string, text: string) => {
    return apiPost<{ ok: boolean; error?: string }>(`/api/process/${processName}/input`, { text })
  }, [])

  const stopProcess = useCallback(async (processName: string) => {
    return apiPost<{ ok: boolean; error?: string }>(`/api/process/${processName}/stop`)
  }, [])

  return { runPreflight, sendProcessInput, stopProcess }
}
