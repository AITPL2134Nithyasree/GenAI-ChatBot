import { useState } from 'react'
import type { ConversationSummary } from '../types'
import { EditIcon, MoonIcon, PlusIcon, SettingsIcon, SunIcon, TrashIcon } from './Icons'

interface Props {
  open: boolean
  conversations: ConversationSummary[]
  activeId: string | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

function groupLabel(ts: number): string {
  const d = new Date(ts * 1000)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 86_400_000
  if (d.getTime() >= startOfToday) return 'Today'
  if (d.getTime() >= startOfToday - day) return 'Yesterday'
  if (d.getTime() >= startOfToday - 7 * day) return 'Previous 7 days'
  if (d.getTime() >= startOfToday - 30 * day) return 'Previous 30 days'
  return 'Older'
}

export default function Sidebar(p: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const groups: [string, ConversationSummary[]][] = []
  for (const c of p.conversations) {
    const label = groupLabel(c.updated_at)
    const last = groups[groups.length - 1]
    if (last && last[0] === label) last[1].push(c)
    else groups.push([label, [c]])
  }

  const commit = (id: string) => {
    const t = draft.trim()
    if (t) p.onRename(id, t)
    setEditingId(null)
  }

  return (
    <aside className={`sidebar ${p.open ? 'open' : 'closed'}`}>
      <button className="new-chat" onClick={p.onNew}>
        <PlusIcon /> New chat
      </button>

      <nav className="history">
        {groups.length === 0 && <p className="muted small pad">No conversations yet.</p>}
        {groups.map(([label, items]) => (
          <div key={label} className="group">
            <div className="group-label">{label}</div>
            {items.map((c) => (
              <div
                key={c.id}
                className={`history-item ${c.id === p.activeId ? 'active' : ''}`}
                onClick={() => editingId !== c.id && p.onSelect(c.id)}
                title={c.title}
              >
                {editingId === c.id ? (
                  <input
                    autoFocus
                    className="rename-input"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commit(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit(c.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <>
                    <span className="title">{c.title}</span>
                    <span className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Rename"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDraft(c.title)
                          setEditingId(c.id)
                        }}
                      >
                        <EditIcon size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete "${c.title}"?`)) p.onDelete(c.id)
                        }}
                      >
                        <TrashIcon size={15} />
                      </button>
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="footer-btn" onClick={p.onOpenSettings}>
          <SettingsIcon /> Settings
        </button>
        <button className="footer-btn" onClick={p.onToggleTheme}>
          {p.theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          {p.theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </aside>
  )
}
