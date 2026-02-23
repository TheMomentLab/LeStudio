import { useCallback } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { useLeStudioStore } from '../store'

export const useConfig = () => {
  const config = useLeStudioStore((s) => s.config)
  const setConfig = useLeStudioStore((s) => s.setConfig)
  const updateConfig = useLeStudioStore((s) => s.updateConfig)

  const loadConfig = useCallback(async () => {
    const cfg = await apiGet<Record<string, unknown>>('/api/config')
    setConfig(cfg)
    return cfg
  }, [setConfig])

  const saveConfig = useCallback(
    async (cfg?: Record<string, unknown>) => {
      const target = cfg ?? config
      await apiPost('/api/config', target)
      return target
    },
    [config],
  )

  const buildConfig = useCallback(
    async (partial: Record<string, unknown>) => {
      const next = { ...config, ...partial }
      updateConfig(partial)
      await apiPost('/api/config', next)
      return next
    },
    [config, updateConfig],
  )

  return { config, loadConfig, saveConfig, buildConfig }
}
