import { memo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { Message } from '../types'
import { CheckIcon, CopyIcon, RefreshIcon } from './Icons'

function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return { copied, copy }
}

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (node && typeof node === 'object' && 'props' in node)
    return nodeText((node as { props: { children?: ReactNode } }).props.children)
  return ''
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const { copied, copy } = useCopy()
  const child = Array.isArray(children) ? children[0] : children
  const className = (child as { props?: { className?: string } })?.props?.className ?? ''
  const lang = /language-([\w-]+)/.exec(className)?.[1] ?? 'text'
  return (
    <div className="code-block">
      <div className="code-header">
        <span>{lang}</span>
        <button onClick={() => copy(nodeText(children))}>
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />} {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      components={{
        pre: CodeBlock,
        a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
      }}
    >
      {text}
    </ReactMarkdown>
  )
})

interface Props {
  message: Message
  streaming?: boolean
  canRegenerate?: boolean
  onRegenerate?: () => void
}

export default function ChatMessage({ message, streaming, canRegenerate, onRegenerate }: Props) {
  const { copied, copy } = useCopy()

  if (message.role === 'user') {
    return (
      <div className="msg-row user">
        <div className="user-bubble">{message.content}</div>
      </div>
    )
  }

  return (
    <div className="msg-row assistant">
      <div className="avatar">✦</div>
      <div className="assistant-body">
        {message.error ? (
          <div className="error-box">{message.content}</div>
        ) : message.content ? (
          <div className={`markdown ${streaming ? 'streaming' : ''}`}>
            <Markdown text={message.content} />
          </div>
        ) : (
          <div className="typing">
            <span />
            <span />
            <span />
          </div>
        )}
        {!streaming && message.content && (
          <div className="msg-actions">
            {!message.error && (
              <button className="icon-btn" aria-label="Copy" onClick={() => copy(message.content)}>
                {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
              </button>
            )}
            {canRegenerate && (
              <button className="icon-btn" aria-label="Regenerate" onClick={onRegenerate}>
                <RefreshIcon size={15} />
              </button>
            )}
            {message.model && <span className="muted small">{message.model}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
