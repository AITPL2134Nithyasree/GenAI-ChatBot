export type Role = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: Role
  content: string
  model?: string | null
  error?: boolean
}

export interface ConversationSummary {
  id: string
  title: string
  model: string | null
  created_at: number
  updated_at: number
}

export interface Conversation extends ConversationSummary {
  messages: Message[]
}

export interface ModelInfo {
  id: string
  name: string
  context_length: number | null
  description: string
}

export type StreamEvent =
  | { type: 'meta'; conversation_id: string }
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }
