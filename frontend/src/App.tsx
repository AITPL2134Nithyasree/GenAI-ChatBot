import { useCallback, useEffect, useRef, useState } from 'react'
import { api, streamChat, type ChatParams } from './api'
import ChatMessage from './components/ChatMessage'
import Composer from './components/Composer'
import { MenuIcon, PlusIcon } from './components/Icons'
import ModelSelector from './components/ModelSelector'
import SettingsModal from './components/SettingsModal'
import Sidebar from './components/Sidebar'
import type { ConversationSummary, Message, ModelInfo } from './types'

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* storage unavailable */
    }
  },
}

// openrouter/free auto-routes to an available free model, so it survives per-provider rate limits
const PREFERRED = ['openrouter/free', 'deepseek', 'llama-3.3', 'gemini', 'qwen', 'mistral']
const SUGGESTIONS = [
  'Explain quantum computing in simple terms',
  'Write a Python function to merge two sorted lists',
  'Give me 5 creative ideas for a weekend project',
  'Summarize the pros and cons of FastAPI vs Flask',
]

const uid = () => Math.random().toString(36).slice(2)

export default function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [model, setModel] = useState<string>(store.get('model') ?? '')
  const [streaming, setStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768)
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (store.get('theme') as 'light' | 'dark') ??
      (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  )
  const [systemPrompt, setSystemPrompt] = useState(store.get('systemPrompt') ?? '')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyMissing, setApiKeyMissing] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    store.set('theme', theme)
  }, [theme])

  const refreshConversations = useCallback(() => {
    api.conversations().then(setConversations).catch(() => {})
  }, [])

  useEffect(() => {
    refreshConversations()
    api
      .health()
      .then((h) => setApiKeyMissing(!h.api_key_configured))
      .catch(() => {})
    api
      .models()
      .then((list) => {
        setModels(list)
        setModel((cur) => {
          if (cur && list.some((m) => m.id === cur)) return cur
          for (const p of PREFERRED) {
            const hit = list.find((m) => m.id.includes(p))
            if (hit) return hit.id
          }
          return list[0]?.id ?? ''
        })
      })
      .catch((e: Error) => setModelsError(e.message))
      .finally(() => setModelsLoading(false))
  }, [refreshConversations])

  useEffect(() => {
    if (model) store.set('model', model)
  }, [model])

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const stop = () => abortRef.current?.abort()

  const newChat = () => {
    stop()
    setActiveId(null)
    setMessages([])
    if (window.innerWidth <= 768) setSidebarOpen(false)
  }

  const selectConversation = async (id: string) => {
    stop()
    setActiveId(id)
    if (window.innerWidth <= 768) setSidebarOpen(false)
    try {
      const conv = await api.conversation(id)
      setMessages(conv.messages)
      stickToBottom.current = true
      if (conv.model && models.some((m) => m.id === conv.model)) setModel(conv.model)
    } catch {
      setMessages([])
    }
  }

  const run = async (params: ChatParams) => {
    const assistantId = uid()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', model: params.model }])
    setStreaming(true)
    stickToBottom.current = true
    const controller = new AbortController()
    abortRef.current = controller
    const patch = (fn: (m: Message) => Message) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)))

    try {
      await streamChat(
        { ...params, system_prompt: systemPrompt || undefined },
        (ev) => {
          if (ev.type === 'meta') setActiveId(ev.conversation_id)
          else if (ev.type === 'delta') patch((m) => ({ ...m, content: m.content + ev.content }))
          else if (ev.type === 'error')
            patch((m) => (m.content ? { ...m, content: `${m.content}\n\n> ⚠️ ${ev.message}` } : { ...m, content: ev.message, error: true }))
        },
        controller.signal,
      )
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        patch((m) => ({ ...m, content: (e as Error).message || 'Request failed', error: true }))
    } finally {
      // Drop the empty placeholder if the user stopped before any tokens arrived
      setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content)))
      setStreaming(false)
      abortRef.current = null
      refreshConversations()
    }
  }

  const send = (text: string) => {
    if (!model) return
    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }])
    run({ model, message: text, conversation_id: activeId })
  }

  const regenerate = () => {
    if (!activeId || !model) return
    setMessages((prev) => (prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev))
    run({ model, conversation_id: activeId, regenerate: true })
  }

  const rename = async (id: string, title: string) => {
    await api.rename(id, title).catch(() => {})
    refreshConversations()
  }

  const remove = async (id: string) => {
    await api.remove(id).catch(() => {})
    if (id === activeId) newChat()
    refreshConversations()
  }

  const lastIdx = messages.length - 1

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onOpenSettings={() => setShowSettings(true)}
        onNew={newChat}
        onSelect={selectConversation}
        onRename={rename}
        onDelete={remove}
      />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn" aria-label="Toggle sidebar" onClick={() => setSidebarOpen((o) => !o)}>
            <MenuIcon />
          </button>
          <ModelSelector
            models={models}
            value={model}
            loading={modelsLoading}
            error={modelsError}
            onChange={setModel}
          />
          <button className="icon-btn push-right" aria-label="New chat" onClick={newChat}>
            <PlusIcon />
          </button>
        </header>

        {apiKeyMissing && (
          <div className="banner">
            OPENROUTER_API_KEY is not configured. Add it to <code>backend/.env</code> and restart the backend.
          </div>
        )}

        <div className="messages" ref={scrollRef} onScroll={onScroll}>
          {messages.length === 0 ? (
            <div className="empty">
              <h1>What can I help with?</h1>
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="suggestion" onClick={() => send(s)} disabled={!model || streaming}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="thread">
              {messages.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  streaming={streaming && i === lastIdx}
                  canRegenerate={!streaming && i === lastIdx && m.role === 'assistant' && !!activeId}
                  onRegenerate={regenerate}
                />
              ))}
            </div>
          )}
        </div>

        <Composer disabled={!model} streaming={streaming} onSend={send} onStop={stop} />
      </main>

      {showSettings && (
        <SettingsModal
          systemPrompt={systemPrompt}
          onSave={(p) => {
            setSystemPrompt(p)
            store.set('systemPrompt', p)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
