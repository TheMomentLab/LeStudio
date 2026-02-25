import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiDelete } from '../../lib/api'
import { useLeStudioStore } from '../../store'

interface ProfileListResponse {
  profiles: string[]
  active: string
}

export function ProfileSelector() {
  const config = useLeStudioStore((s) => s.config)
  const setConfig = useLeStudioStore((s) => s.setConfig)
  const addToast = useLeStudioStore((s) => s.addToast)

  const [profiles, setProfiles] = useState<string[]>(['default'])
  const [activeProfile, setActiveProfile] = useState('default')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<ProfileListResponse>('/api/profiles')
      setProfiles(res.profiles)
      setActiveProfile(res.active)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /* close more-menu on outside click */
  useEffect(() => {
    if (!moreOpen) return
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [moreOpen])

  const applySelected = async (name: string) => {
    try {
      const res = await apiGet<import('../../lib/types').LeStudioConfig>(`/api/profiles/${encodeURIComponent(name)}`)
      if (res) {
        setConfig(res)
        setActiveProfile(name)
        addToast(`Profile "${name}" applied`, 'success')
      }
    } catch {
      addToast('Failed to load profile', 'error')
    }
  }

  const saveCurrent = async () => {
    try {
      await apiPost(`/api/profiles/${encodeURIComponent(activeProfile)}`, config)
      addToast(`Profile "${activeProfile}" saved`, 'success')
    } catch {
      addToast('Failed to save profile', 'error')
    }
  }

  const saveAs = async () => {
    const name = prompt('Save profile as:')
    if (!name) return
    try {
      await apiPost(`/api/profiles/${encodeURIComponent(name)}`, config)
      setActiveProfile(name)
      await refresh()
      addToast(`Profile "${name}" created`, 'success')
    } catch {
      addToast('Failed to save profile', 'error')
    }
  }

  const exportCurrent = async () => {
    try {
      const data = await apiGet<Record<string, unknown>>(`/api/profiles/${encodeURIComponent(activeProfile)}`)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeProfile}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast('Failed to export profile', 'error')
    }
  }

  const triggerImport = () => {
    importRef.current?.click()
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const name = (data.profile_name as string) || file.name.replace(/\.json$/, '')
      await apiPost('/api/profiles-import', { name, config: data })
      await refresh()
      addToast(`Profile "${name}" imported`, 'success')
    } catch {
      addToast('Failed to import profile', 'error')
    }
  }

  const deleteCurrent = async () => {
    if (activeProfile === 'default') {
      addToast('Cannot delete default profile', 'error')
      return
    }
    if (!confirm(`Delete profile "${activeProfile}"?`)) return
    try {
      await apiDelete(`/api/profiles/${encodeURIComponent(activeProfile)}`)
      setActiveProfile('default')
      await refresh()
      addToast(`Profile "${activeProfile}" deleted`, 'success')
    } catch {
      addToast('Failed to delete profile', 'error')
    }
  }

  return (
    <div className="header-profile-controls">
      <select
        id="profile-select"
        value={activeProfile}
        onChange={(e) => applySelected(e.target.value)}
        aria-label="Profile selector"
      >
        {profiles.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <button className="btn-xs" onClick={saveCurrent}>
        Save
      </button>
      <div className="profile-more-wrap" ref={moreRef}>
        <button
          className="btn-xs profile-more-btn"
          onClick={() => setMoreOpen(!moreOpen)}
          title="More profile actions"
          aria-label="More profile actions"
        >
          ⋮
        </button>
        {moreOpen && (
          <div className="profile-more-menu">
            <button
              onClick={() => {
                saveAs()
                setMoreOpen(false)
              }}
            >
              Save As…
            </button>
            <button
              onClick={() => {
                exportCurrent()
                setMoreOpen(false)
              }}
            >
              Export…
            </button>
            <button
              onClick={() => {
                triggerImport()
                setMoreOpen(false)
              }}
            >
              Import…
            </button>
            <hr />
            <button
              className="danger"
              onClick={() => {
                deleteCurrent()
                setMoreOpen(false)
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleImportFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
