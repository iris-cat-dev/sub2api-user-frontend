export type ChatProtocol = 'responses' | 'chat-completions' | 'messages'
export type ChatAttachmentKind = 'image' | 'pdf' | 'text'

export interface ChatAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  kind: ChatAttachmentKind
  data: string
}


export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments: ChatAttachment[]
  reasoning: string
  status: 'streaming' | 'done' | 'stopped' | 'error'
  error: string | null
  model: string
  createdAt: number
}

export interface ChatConversation {
  id: string
  userId: number
  title: string
  keyId: number | null
  model: string
  protocol: ChatProtocol
  messages: ChatMessage[]
  draft: string
  draftAttachments: ChatAttachment[]
  createdAt: number
  updatedAt: number
}

export interface ChatReply {
  content: string
  reasoning: string
}

export interface ChatRequest {
  apiKey: string
  model: string
  protocol: ChatProtocol
  messages: ChatMessage[]
  signal?: AbortSignal
  /** 请求超时，单位毫秒 */
  timeout?: number
  onUpdate?: (reply: ChatReply) => void
}
