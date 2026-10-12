import { computed, getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'
import { requestChat } from './client'
import { deleteChatConversation, loadChatConversations, saveChatConversation } from './history'
import type { ChatAttachment, ChatConversation, ChatMessage, ChatProtocol, ChatReply } from './types'

interface RunningReply {
  controller: AbortController
  messageId: string
  epoch: number
}
function cloneAttachments(attachments: ChatAttachment[]): ChatAttachment[] {
  return attachments.map(attachment => ({
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind,
    data: attachment.data,
  }))
}


function snapshot(conversation: ChatConversation): ChatConversation {
  // Whitelist domain fields; a reactive object or imported extra field must never
  // carry connection credentials into a queued durable write.
  return {
    id: conversation.id, userId: conversation.userId, title: conversation.title,
    keyId: conversation.keyId, model: conversation.model, protocol: conversation.protocol,
    draft: conversation.draft, draftAttachments: cloneAttachments(conversation.draftAttachments),
    createdAt: conversation.createdAt, updatedAt: conversation.updatedAt,
    messages: conversation.messages.map(message => ({
      id: message.id, role: message.role, content: message.content,
      attachments: cloneAttachments(message.attachments), reasoning: message.reasoning,
      status: message.status, error: message.error, model: message.model, createdAt: message.createdAt,
    })),
  }
}

export function useChat(userId: Ref<number>) {
  const conversations = ref<ChatConversation[]>([])
  const activeId = ref<string | null>(null)
  const loading = ref(true)
  const historyError = ref('')
  const runningIds = ref<string[]>([])
  const activeConversation = computed(() => conversations.value.find(item => item.id === activeId.value) ?? null)
  const runs = new Map<string, RunningReply>()
  const pendingWrites = new Map<string, ChatConversation>()
  let persistence: Promise<void> = Promise.resolve()
  let account = 0
  let epoch = 0
  let loaded = false
  let disposed = false
  let initialization: { epoch: number; promise: Promise<void> } | null = null

  function persistenceError(owner: number, error: unknown): void {
    if (!disposed && account === owner) historyError.value = `Chat history could not be saved: ${error instanceof Error ? error.message : String(error)}`
  }

  function enqueue(owner: number, operation: () => Promise<void>): Promise<void> {
    const task = persistence.then(operation)
    // Keep the queue usable after failure without hiding the failed write.
    persistence = task.catch(error => persistenceError(owner, error))
    return task
  }

  function persist(conversation: ChatConversation): void {
    const key = `${conversation.userId}:${conversation.id}`
    const queued = pendingWrites.has(key)
    pendingWrites.set(key, snapshot(conversation))
    if (queued) return
    void enqueue(conversation.userId, async () => {
      const latest = pendingWrites.get(key)
      pendingWrites.delete(key)
      if (latest) await saveChatConversation(latest.userId, latest)
    }).catch(() => undefined)
  }

  function persistSelection(): void {
    if (!account) return
    try {
      const key = `sub2api-chat-active:${account}`
      if (activeId.value) localStorage.setItem(key, activeId.value)
      else localStorage.removeItem(key)
    } catch (error) { persistenceError(account, error) }
  }

  function patchMessage(id: string, messageId: string, patch: Partial<Pick<ChatMessage, 'content' | 'reasoning' | 'status' | 'error'>>): void {
    const conversation = conversations.value.find(item => item.id === id)
    const message = conversation?.messages.find(item => item.id === messageId)
    if (!conversation || !message) return
    Object.assign(message, patch)
    conversation.updatedAt = Date.now()
    persist(conversation)
  }

  function stop(id = activeId.value ?? ''): void {
    const run = runs.get(id)
    if (!run) return
    patchMessage(id, run.messageId, { status: 'stopped', error: null })
    runs.delete(id)
    runningIds.value = runningIds.value.filter(value => value !== id)
    run.controller.abort(new DOMException('Request stopped', 'AbortError'))
  }

  async function load(): Promise<void> {
    if (disposed) return
    if (initialization?.epoch === epoch) return initialization.promise
    if (loaded && !historyError.value) return
    const owner = account
    const generation = epoch
    const promise = (async () => {
      loading.value = true
      if (!Number.isSafeInteger(owner) || owner <= 0) {
        if (generation === epoch) loading.value = false
        return
      }
      try {
        await persistence
        if (disposed || generation !== epoch) return
        if (loaded) {
          // Retry the latest in-memory state; reloading would discard unsaved replies.
          const records = conversations.value.map(snapshot)
          await enqueue(owner, async () => {
            for (const record of records) await saveChatConversation(owner, record)
          })
          if (disposed || generation !== epoch) return
          historyError.value = ''
          persistSelection()
          return
        }
        const records = await loadChatConversations(owner)
        if (disposed || generation !== epoch) return
        if (historyError.value.startsWith('Chat history could not be loaded:')) historyError.value = ''
        conversations.value = records
        let selection: string | null = null
        try { selection = localStorage.getItem(`sub2api-chat-active:${owner}`) }
        catch (error) { persistenceError(owner, error) }
        activeId.value = records.find(item => item.id === selection)?.id ?? records[0]?.id ?? null
        loaded = true
        persistSelection()
      } catch (error) {
        if (!disposed && generation === epoch) historyError.value = `Chat history could not be loaded: ${error instanceof Error ? error.message : String(error)}`
      } finally {
        if (!disposed && generation === epoch) loading.value = false
      }
    })()
    initialization = { epoch: generation, promise }
    try { await promise }
    finally { if (initialization?.epoch === generation) initialization = null }
  }

  function requireReady(): void {
    if (disposed || loading.value || !loaded || account !== userId.value || account <= 0) throw new Error('Wait for chat history to load before editing conversations')
  }

  function createConversation(keyId: number | null = null, model = '', protocol: ChatProtocol = 'chat-completions'): ChatConversation {
    requireReady()
    const now = Date.now()
    const conversation: ChatConversation = {
      id: crypto.randomUUID(), userId: account, title: '', keyId, model, protocol,
      messages: [], draft: '', draftAttachments: [], createdAt: now, updatedAt: now,
    }
    conversations.value.unshift(conversation)
    activeId.value = conversation.id
    persistSelection()
    persist(conversation)
    return conversation
  }

  function selectConversation(id: string): void {
    if (disposed || !conversations.value.some(item => item.id === id)) return
    activeId.value = id
    persistSelection()
  }

  function updateConversation(id: string, patch: Partial<Pick<ChatConversation, 'title' | 'keyId' | 'model' | 'protocol' | 'draft' | 'draftAttachments'>>): void {
    if (disposed) return
    const conversation = conversations.value.find(item => item.id === id)
    if (!conversation) return
    if (patch.title !== undefined) conversation.title = patch.title.trim()
    if (patch.keyId !== undefined) conversation.keyId = patch.keyId
    if (patch.model !== undefined) conversation.model = patch.model
    if (patch.protocol !== undefined) conversation.protocol = patch.protocol
    if (patch.draft !== undefined) conversation.draft = patch.draft
    if (patch.draftAttachments !== undefined) conversation.draftAttachments = cloneAttachments(patch.draftAttachments)
    conversation.updatedAt = Date.now()
    persist(conversation)
  }

  async function deleteConversation(id: string): Promise<void> {
    requireReady()
    const conversation = conversations.value.find(item => item.id === id)
    if (!conversation) return
    stop(id)
    const removed = snapshot(conversation)
    const owner = account
    const generation = epoch
    const wasActive = activeId.value === id
    pendingWrites.delete(`${owner}:${id}`)
    conversations.value = conversations.value.filter(item => item.id !== id)
    if (wasActive) activeId.value = conversations.value[0]?.id ?? null
    persistSelection()
    try { await enqueue(owner, () => deleteChatConversation(owner, id)) }
    catch (error) {
      if (!disposed && generation === epoch && !conversations.value.some(item => item.id === id)) {
        conversations.value.unshift(removed)
        if (wasActive && !activeId.value) activeId.value = id
        persistSelection()
      }
      throw error
    }
  }

  async function generate(conversation: ChatConversation, apiKey: string, context: ChatMessage[]): Promise<void> {
    const generation = epoch
    const id = conversation.id
    const message: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant', content: '', attachments: [], reasoning: '', status: 'streaming',
      error: null, model: conversation.model, createdAt: Date.now(),
    }
    const run: RunningReply = { controller: new AbortController(), messageId: message.id, epoch: generation }
    runs.set(id, run)
    runningIds.value = [...runs.keys()]
    conversation.messages.push(message)
    persist(conversation)
    const current = () => !disposed && epoch === run.epoch && runs.get(id) === run && conversations.value.some(item => item.id === id)
    try {
      const reply = await requestChat({
        apiKey, model: conversation.model, protocol: conversation.protocol,
        messages: context, signal: run.controller.signal,
        onUpdate: (reply: ChatReply) => { if (current()) patchMessage(id, message.id, reply) },
      })
      if (current()) patchMessage(id, message.id, { ...reply, status: 'done', error: null })
    } catch (error) {
      if (current()) patchMessage(id, message.id, {
        status: run.controller.signal.aborted ? 'stopped' : 'error',
        error: run.controller.signal.aborted ? null : error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (runs.get(id) === run) {
        runs.delete(id)
        runningIds.value = [...runs.keys()]
      }
      // Await queued final output, but do not let persistence failure replace the
      // visible generation result; the queue reports it through historyError.
      await persistence
    }
  }

  async function send(apiKey: string, content: string): Promise<void> {
    requireReady()
    if (!content.trim() && !activeConversation.value?.draftAttachments.length) return
    const conversation = activeConversation.value
    if (!conversation || runs.has(conversation.id)) return
    if (!apiKey.trim()) throw new Error('Select an API key before sending')
    if (!conversation.model.trim()) throw new Error('Select a chat model before sending')
    const attachments = cloneAttachments(conversation.draftAttachments)
    if (!conversation.messages.some(message => message.role === 'user') && !conversation.title) {
      conversation.title = (content.trim().replace(/\s+/g, ' ') || attachments[0]?.name || '').slice(0, 60)
    }
    conversation.messages.push({
      id: crypto.randomUUID(), role: 'user', content, attachments, reasoning: '', status: 'done', error: null,
      model: conversation.model, createdAt: Date.now(),
    })
    conversation.draft = ''
    conversation.draftAttachments = []
    conversation.updatedAt = Date.now()
    const context = conversation.messages.filter(message => message.role === 'user' || !!message.content).map(message => ({ ...message, attachments: cloneAttachments(message.attachments) }))
    await generate(conversation, apiKey, context)
  }

  async function regenerate(apiKey: string): Promise<void> {
    requireReady()
    const conversation = activeConversation.value
    if (!conversation || runs.has(conversation.id)) return
    if (!apiKey.trim()) throw new Error('Select an API key before regenerating')
    if (!conversation.model.trim()) throw new Error('Select a chat model before regenerating')
    let index = conversation.messages.length - 1
    while (index >= 0 && conversation.messages[index]?.role !== 'assistant') index--
    if (index < 0 || index !== conversation.messages.length - 1) return
    const context = conversation.messages.slice(0, index).filter(message => message.role === 'user' || !!message.content).map(message => ({ ...message, attachments: cloneAttachments(message.attachments) }))
    if (!context.some(message => message.role === 'user')) return
    conversation.messages.splice(index)
    conversation.updatedAt = Date.now()
    await generate(conversation, apiKey, context)
  }

  const unwatch = watch(userId, value => {
    for (const id of [...runs.keys()]) stop(id)
    epoch++
    account = value
    loaded = false
    initialization = null
    conversations.value = []
    activeId.value = null
    runningIds.value = []
    historyError.value = ''
    loading.value = true
    void load()
  }, { immediate: true, flush: 'sync' })

  function dispose(): void {
    if (disposed) return
    for (const id of [...runs.keys()]) stop(id)
    unwatch()
    disposed = true
    epoch++
  }

  if (getCurrentScope()) onScopeDispose(dispose)
  return {
    conversations, activeId, loading, historyError, runningIds, activeConversation,
    load, createConversation, selectConversation, updateConversation, deleteConversation,
    send, regenerate, stop, dispose,
  }
}
