import { useState } from 'react'

interface Props {
  systemPrompt: string
  onSave: (prompt: string) => void
  onClose: () => void
}

export default function SettingsModal({ systemPrompt, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(systemPrompt)
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <label className="field-label" htmlFor="sys">
          Custom instructions (system prompt)
        </label>
        <textarea
          id="sys"
          rows={6}
          value={draft}
          placeholder="Leave empty to use the server default."
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onSave(draft.trim())
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
