import type { Conversation, ConversationSummary, ModelInfo, StreamEvent } from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* ignore non-JSON bodies */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => fetch(`${BASE}/api/health`).then((r) => json<{ ok: boolean; api_key_configured: boolean }>(r)),
  models: () => fetch(`${BASE}/api/models`).then((r) => json<ModelInfo[]>(r)),
  conversations: () => fetch(`${BASE}/api/conversations`).then((r) => json<ConversationSummary[]>(r)),
  conversation: (id: string) => fetch(`${BASE}/api/conversations/${id}`).then((r) => json<Conversation>(r)),
  rename: (id: string, title: string) =>
    fetch(`${BASE}/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }).then((r) => json<{ ok: boolean }>(r)),
  remove: (id: string) =>
    fetch(`${BASE}/api/conversations/${id}`, { method: 'DELETE' }).then((r) => json<{ ok: boolean }>(r)),
}

export interface ChatParams {
  model: string
  message?: string
  conversation_id?: string | null
  system_prompt?: string
  regenerate?: boolean
}

/** POST /api/chat and invoke onEvent for each SSE event until the stream ends. */
export async function streamChat(params: ChatParams, onEvent: (e: StreamEvent) => void, signal: AbortSignal) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
  if (!res.ok || !res.body) {
    await json(res)
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of raw.split('\n')) {
        if (line.startsWith('data:')) onEvent(JSON.parse(line.slice(5).trim()) as StreamEvent)
      }
    }
  }
}
