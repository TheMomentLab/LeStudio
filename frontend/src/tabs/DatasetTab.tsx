import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import type { DatasetDetail, DatasetListItem } from '../lib/types'
import { useLeStudioStore } from '../store'

interface DatasetTabProps {
  active: boolean
}

const tagOptions = ['all', 'good', 'bad', 'review', 'untagged'] as const
type TagFilter = (typeof tagOptions)[number]

export function DatasetTab({ active }: DatasetTabProps) {
  const addToast = useLeStudioStore((s) => s.addToast)
  const [datasets, setDatasets] = useState<DatasetListItem[]>([])
  const [selected, setSelected] = useState<DatasetDetail | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<number>(0)
  const [tags, setTags] = useState<Record<string, 'good' | 'bad' | 'review'>>({})
  const [filter, setFilter] = useState<TagFilter>('all')

  const refreshList = async () => {
    const res = await apiGet<{ datasets: DatasetListItem[] }>('/api/datasets')
    setDatasets(res.datasets ?? [])
  }

  useEffect(() => {
    if (!active) return
    refreshList()
  }, [active])

  const loadDataset = async (id: string) => {
    const [user, repo] = id.split('/')
    if (!user || !repo) return
    const detail = await apiGet<DatasetDetail>(`/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`)
    setSelected(detail)
    if (detail.episodes.length > 0) setSelectedEpisode(detail.episodes[0].episode_index)
    const tagRes = await apiGet<{ ok: boolean; tags: Record<string, 'good' | 'bad' | 'review'> }>(`/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tags`)
    setTags(tagRes.ok ? tagRes.tags ?? {} : {})
  }

  const filteredEpisodes = useMemo(() => {
    if (!selected) return []
    if (filter === 'all') return selected.episodes
    return selected.episodes.filter((ep) => {
      const tag = tags[String(ep.episode_index)] ?? 'untagged'
      return tag === filter
    })
  }, [selected, filter, tags])

  useEffect(() => {
    if (filteredEpisodes.length === 0) return
    if (!filteredEpisodes.some((ep) => ep.episode_index === selectedEpisode)) {
      setSelectedEpisode(filteredEpisodes[0].episode_index)
    }
  }, [filteredEpisodes, selectedEpisode])

  const tagEpisode = async (tag: 'good' | 'bad' | 'review' | 'untagged') => {
    if (!selected) return
    const [user, repo] = selected.dataset_id.split('/')
    if (!user || !repo) return
    const res = await apiPost<{ ok: boolean; error?: string }>(`/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/tags`, {
      episode_index: selectedEpisode,
      tag,
    })
    if (!res.ok) {
      addToast(`Tag failed: ${res.error ?? 'unknown error'}`, 'error')
      return
    }
    if (tag === 'untagged') {
      setTags((prev) => {
        const next = { ...prev }
        delete next[String(selectedEpisode)]
        return next
      })
    } else {
      setTags((prev) => ({ ...prev, [String(selectedEpisode)]: tag }))
    }
    addToast(`Episode ${selectedEpisode} tagged: ${tag}`, 'info')
  }

  return (
    <section id="tab-dataset" className={`tab ${active ? 'active' : ''}`}>
      <div className="section-header">
        <h2>Dataset Viewer</h2>
        <button onClick={refreshList} className="btn-sm">
          ↺ Refresh List
        </button>
      </div>

      <div className="two-col">
        <div className="card" style={{ maxHeight: 800, display: 'flex', flexDirection: 'column' }}>
          <h3>Local Datasets</h3>
          <div id="dataset-list" className="device-list" style={{ overflowY: 'auto', flex: 1 }}>
            {datasets.length === 0
              ? 'No datasets found in cache'
              : datasets.map((ds) => (
                  <div
                    className={`device-item ${selected?.dataset_id === ds.id ? 'selected' : ''}`}
                    key={ds.id}
                    style={{ cursor: 'pointer', alignItems: 'flex-start' }}
                    onClick={() => loadDataset(ds.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{ds.id}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                        {ds.total_episodes ?? 0} episodes · {ds.total_frames ?? 0} frames · {ds.size_mb ?? 0} MB
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selected ? (
            <div id="dataset-detail-empty" className="dataset-empty-state">
              <div className="dataset-empty-icon">📂</div>
              <div className="dataset-empty-title">No dataset selected</div>
              <div className="dataset-empty-hint">Select a dataset from the list to view details and replay episodes.</div>
            </div>
          ) : (
            <div id="dataset-detail-view" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 id="ds-title" style={{ marginBottom: 4 }}>
                  {selected.dataset_id}
                </h3>
                <div id="ds-stats" className="muted" style={{ fontSize: 13 }}>
                  {selected.total_episodes} episodes · {selected.total_frames} frames · {selected.fps} FPS · Cameras: {selected.cameras.join(', ') || 'None'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <label>Episode:</label>
                <select id="ds-ep-select" value={selectedEpisode} onChange={(e) => setSelectedEpisode(Number(e.target.value))} style={{ flex: 1, minWidth: 160 }}>
                  {filteredEpisodes.map((ep) => (
                    <option key={ep.episode_index} value={ep.episode_index}>
                      Episode {ep.episode_index} ({ep.length ?? 0} frames)
                    </option>
                  ))}
                </select>
                <select id="ds-tag-filter" value={filter} onChange={(e) => setFilter(e.target.value as TagFilter)}>
                  <option value="all">All episodes</option>
                  <option value="good">👍 Good</option>
                  <option value="bad">👎 Bad</option>
                  <option value="review">🔍 Review</option>
                  <option value="untagged">Untagged</option>
                </select>
              </div>

              <div id="ds-video-grid" className="video-preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {selected.cameras.length === 0 ? (
                  <div className="muted" style={{ gridColumn: '1/-1' }}>
                    No video data in this dataset.
                  </div>
                ) : (
                  selected.cameras.map((cam) => {
                    const [user, repo] = selected.dataset_id.split('/')
                    return (
                      <div key={cam} style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ padding: '6px 10px', fontSize: 11, fontFamily: 'var(--mono)', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>{cam}</div>
                        <video
                          className="ds-video"
                          src={`/api/datasets/${encodeURIComponent(user)}/${encodeURIComponent(repo)}/episodes/${selectedEpisode}/video/${encodeURIComponent(cam)}`}
                          controls
                          preload="metadata"
                          style={{ width: '100%', display: 'block' }}
                        />
                      </div>
                    )
                  })
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 28 }}>Tag:</span>
                <button id="ds-tag-good" className="btn-xs" onClick={() => tagEpisode('good')}>
                  👍 Good
                </button>
                <button id="ds-tag-bad" className="btn-xs" onClick={() => tagEpisode('bad')}>
                  👎 Bad
                </button>
                <button id="ds-tag-review" className="btn-xs" onClick={() => tagEpisode('review')}>
                  🔍 Review
                </button>
                <button id="ds-tag-clear" className="btn-xs" onClick={() => tagEpisode('untagged')}>
                  ✕ Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
