import { useEffect, useRef, useState } from 'react'
import { SendIcon, StopIcon } from './Icons'

interface Props {
  disabled: boolean
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}

export default function Composer({ disabled, streaming, onSend, onStop }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  useEffect(() => {
    if (!streaming) ref.current?.focus()
  }, [streaming])

  const submit = () => {
    const t = text.trim()
    if (!t || disabled || streaming) return
    onSend(t)
    setText('')
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder="Message ChatGPT Clone"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        {streaming ? (
          <button className="send-btn" onClick={onStop} aria-label="Stop generating">
            <StopIcon />
          </button>
        ) : (
          <button className="send-btn" onClick={submit} disabled={!text.trim() || disabled} aria-label="Send">
            <SendIcon />
          </button>
        )}
      </div>
      <p className="disclaimer">Free models via OpenRouter can make mistakes. Check important info.</p>
    </div>
  )
}
