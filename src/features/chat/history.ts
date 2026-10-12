import { isValidChatAttachmentData, MAX_CHAT_ATTACHMENT_CONTEXT_BYTES, MAX_CHAT_ATTACHMENTS_PER_MESSAGE } from './attachments'
import type { ChatAttachment, ChatConversation, ChatMessage } from './types'

const DATABASE = 'sub2api-chat'
const VERSION = 1
const STORE = 'conversations'

type RecordValue = Record<string, unknown>

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function requireOwner(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Sign in to access chat history')
}
function normalizeAttachments(input: unknown, budget: { bytes: number }, ids: Set<string>): ChatAttachment[] {
  if (!Array.isArray(input)) return []
  const attachments: ChatAttachment[] = []
  for (const value of input) {
    if (attachments.length >= MAX_CHAT_ATTACHMENTS_PER_MESSAGE) break
    const item = record(value)
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name
      || typeof item.mimeType !== 'string' || typeof item.size !== 'number'
      || (item.kind !== 'image' && item.kind !== 'pdf' && item.kind !== 'text')
      || typeof item.data !== 'string') continue
    const attachment: ChatAttachment = {
      id: item.id,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      kind: item.kind,
      data: item.data,
    }
    if (!isValidChatAttachmentData(attachment)
      || budget.bytes + attachment.size > MAX_CHAT_ATTACHMENT_CONTEXT_BYTES) continue
    ids.add(attachment.id)
    budget.bytes += attachment.size
    attachments.push(attachment)
  }
  return attachments
}


function normalize(value: unknown, userId: number, restoring: boolean): ChatConversation | null {
  const item = record(value)
  if (!item || item.userId !== userId || typeof item.id !== 'string' || !item.id || !Array.isArray(item.messages)) return null
  const messages: ChatMessage[] = []
  const ids = new Set<string>()
  const attachmentIds = new Set<string>()
  const attachmentBudget = { bytes: 0 }
  for (const value of item.messages) {
    const message = record(value)
    if (!message || typeof message.id !== 'string' || !message.id || ids.has(message.id)
      || (message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') continue
    ids.add(message.id)
    const status = message.status === 'done' || message.status === 'stopped' || message.status === 'error' || message.status === 'streaming'
      ? message.status : message.role === 'user' ? 'done' : 'stopped'
    messages.push({
      id: message.id, role: message.role, content: message.content,
      attachments: message.role === 'user' ? normalizeAttachments(message.attachments, attachmentBudget, attachmentIds) : [],
      reasoning: typeof message.reasoning === 'string' ? message.reasoning : '',
      status: restoring && status === 'streaming' ? 'stopped' : status,
      error: typeof message.error === 'string' ? message.error : null,
      model: typeof message.model === 'string' ? message.model : '',
      createdAt: typeof message.createdAt === 'number' && Number.isFinite(message.createdAt) ? message.createdAt : 0,
    })
  }
  return {
    id: item.id, userId, title: typeof item.title === 'string' ? item.title : '',
    keyId: typeof item.keyId === 'number' && Number.isSafeInteger(item.keyId) && item.keyId > 0 ? item.keyId : null,
    model: typeof item.model === 'string' ? item.model : '',
    protocol: item.protocol === 'responses' || item.protocol === 'messages' ? item.protocol : 'chat-completions',
    messages, draft: typeof item.draft === 'string' ? item.draft : '',
    draftAttachments: normalizeAttachments(item.draftAttachments, attachmentBudget, attachmentIds),
    createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) ? item.createdAt : 0,
    updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : 0,
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let rejected = false
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('userId', 'userId', { unique: false })
    }
    request.onsuccess = () => {
      if (rejected) { request.result.close(); return }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error ?? new Error('Unable to open chat history'))
    request.onblocked = () => {
      rejected = true
      reject(new Error('Close other chat tabs to open chat history'))
    }
  })
}

// Request success is not durability: resolve only after transaction completion.
// Queue ownership checks and mutations in the same readwrite transaction.
async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, result: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      let value: T
      let failure: Error | null = null
      tx.oncomplete = () => resolve(value)
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Chat history transaction aborted'))
      tx.onerror = () => { failure ??= tx.error ?? new Error('Unable to access chat history') }
      const fail = (error: Error) => {
        failure = error
        tx.abort()
      }
      try { operation(tx.objectStore(STORE), result => { value = result }, fail) }
      catch (error) { fail(error instanceof Error ? error : new Error(String(error))) }
    })
  } finally {
    db.close()
  }
}

export async function loadChatConversations(userId: number): Promise<ChatConversation[]> {
  requireOwner(userId)
  const rows = await transaction<unknown[]>('readonly', (store, result) => {
    const request = store.index('userId').getAll(userId)
    request.onsuccess = () => result(request.result)
  })
  const conversations: ChatConversation[] = []
  for (const row of rows) {
    const conversation = normalize(row, userId, true)
    if (conversation) conversations.push(conversation)
  }
  return conversations.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveChatConversation(userId: number, conversation: ChatConversation): Promise<void> {
  requireOwner(userId)
  const snapshot = normalize(conversation, userId, false)
  if (!snapshot) throw new Error('Cannot save an invalid conversation or another account’s chat')
  await transaction<void>('readwrite', (store, result, fail) => {
    const request = store.get(snapshot.id)
    request.onsuccess = () => {
      if (request.result !== undefined && record(request.result)?.userId !== userId) {
        fail(new Error('Cannot overwrite another account’s chat'))
        return
      }
      store.put(snapshot)
      result(undefined)
    }
  })
}

export async function deleteChatConversation(userId: number, id: string): Promise<void> {
  requireOwner(userId)
  await transaction<void>('readwrite', (store, result, fail) => {
    const request = store.get(id)
    request.onsuccess = () => {
      if (request.result !== undefined && record(request.result)?.userId !== userId) {
        fail(new Error('Cannot delete another account’s chat'))
        return
      }
      store.delete(id)
      result(undefined)
    }
  })
}
