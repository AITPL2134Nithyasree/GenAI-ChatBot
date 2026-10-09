import { useEffect, useMemo, useRef, useState } from 'react'
import type { ModelInfo } from '../types'
import { ChevronIcon } from './Icons'

interface Props {
  models: ModelInfo[]
  value: string
  loading: boolean
  error: string | null
  onChange: (id: string) => void
}

const fmtCtx = (n: number | null) => (n ? (n >= 1000 ? `${Math.round(n / 1000)}K ctx` : `${n} ctx`) : '')

export default function ModelSelector({ models, value, loading, error, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase()
    return models.filter((m) => m.name.toLowerCase().includes(s) || m.id.toLowerCase().includes(s))
  }, [models, q])

  const current = models.find((m) => m.id === value)
  const label = loading ? 'Loading models...' : error ? 'Models unavailable' : (current?.name ?? value ?? 'Select a model')

  return (
    <div className="model-selector" ref={ref}>
      <button className="model-trigger" onClick={() => setOpen((o) => !o)} disabled={loading}>
        <span className="model-name">{label.replace(/\s*\(free\)\s*$/i, '')}</span>
        <span className="free-badge">FREE</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="model-menu">
          <input
            autoFocus
            className="model-search"
            placeholder={`Search ${models.length} free models...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="model-list">
            {error && <div className="muted small pad">{error}</div>}
            {filtered.map((m) => (
              <button
                key={m.id}
                className={`model-option ${m.id === value ? 'selected' : ''}`}
                title={m.description}
                onClick={() => {
                  onChange(m.id)
                  setOpen(false)
                  setQ('')
                }}
              >
                <span className="model-option-name">{m.name}</span>
                <span className="model-option-meta">
                  {m.id} {fmtCtx(m.context_length) && `· ${fmtCtx(m.context_length)}`}
                </span>
              </button>
            ))}
            {!error && filtered.length === 0 && <div className="muted small pad">No matches.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
