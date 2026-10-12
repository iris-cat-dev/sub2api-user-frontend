import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useChat } from './useChat'
import type { ChatAttachment, ChatConversation, ChatReply, ChatRequest } from './types'

const storage = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), remove: vi.fn(), request: vi.fn() }))
vi.mock('./history', () => ({ loadChatConversations: storage.load, saveChatConversation: storage.save, deleteChatConversation: storage.remove }))
vi.mock('./client', () => ({ requestChat: storage.request }))

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function stored(userId: number, id: string): ChatConversation {
  return { id, userId, title: id, keyId: 1, model: 'chat-model', protocol: 'responses', messages: [], draft: '', draftAttachments: [], createdAt: 1, updatedAt: 1 }
}

const cleanups: (() => void)[] = []

beforeEach(() => {
  storage.load.mockReset().mockImplementation(async () => [])
  storage.save.mockReset().mockResolvedValue(undefined)
  storage.remove.mockReset().mockResolvedValue(undefined)
  storage.request.mockReset()
  localStorage.clear()
})

afterEach(() => {
  for (const dispose of cleanups.splice(0)) dispose()
})

describe('durable chat account and generation state', () => {
  it('ignores late history from a previous account and restores each account selection independently', async () => {
    const first = deferred<ChatConversation[]>()
    storage.load.mockImplementation((owner: number) => owner === 1 ? first.promise : Promise.resolve([stored(2, 'second-account')]))
    localStorage.setItem('sub2api-chat-active:1', 'first-account')
    localStorage.setItem('sub2api-chat-active:2', 'second-account')
    const user = ref(1)
    const chat = useChat(user)
    cleanups.push(chat.dispose)
    const oldLoad = chat.load()
    // Let the first asynchronous IndexedDB read start, then change accounts.
    await Promise.resolve()
    user.value = 2
    expect(chat.conversations.value).toEqual([])
    expect(chat.activeId.value).toBeNull()
    await chat.load()
    first.resolve([stored(1, 'first-account')])
    await oldLoad
    expect(chat.conversations.value.map(item => item.userId)).toEqual([2])
    expect(chat.activeId.value).toBe('second-account')
    expect(localStorage.getItem('sub2api-chat-active:1')).toBe('first-account')
  })

  it('keeps updates target-bound while switching chats and prevents double submissions', async () => {
    const response = deferred<ChatReply>()
    let request!: ChatRequest
    storage.request.mockImplementation((value: ChatRequest) => { request = value; return response.promise })
    const chat = useChat(ref(1))
    cleanups.push(chat.dispose)
    await chat.load()
    const first = chat.createConversation(1, 'chat-model', 'responses')
    const sending = chat.send('never-persist-secret', 'First prompt')
    await chat.send('never-persist-secret', 'Duplicate prompt')
    const second = chat.createConversation(2, 'chat-model', 'messages')
    request.onUpdate?.({ content: 'original reply', reasoning: 'original reasoning' })
    response.resolve({ content: 'original reply', reasoning: 'original reasoning' })
    await sending
    expect(storage.request).toHaveBeenCalledOnce()
    const original = chat.conversations.value.find(item => item.id === first.id)!
    expect(original.messages.map(item => item.content)).toEqual(['First prompt', 'original reply'])
    expect(original.title).toBe('First prompt')
    expect(chat.activeId.value).toBe(second.id)
    expect(chat.activeConversation.value?.messages).toEqual([])
    expect(JSON.stringify(storage.save.mock.calls)).not.toContain('never-persist-secret')
  })
  it('sends an attachment-only draft and retains the file in later and regenerated context', async () => {
    storage.request.mockResolvedValue({ content: 'seen', reasoning: '' })
    const attachment: ChatAttachment = {
      id: 'file-1',
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 5,
      kind: 'text',
      data: 'hello',
    }
    const chat = useChat(ref(1))
    cleanups.push(chat.dispose)
    await chat.load()
    const conversation = chat.createConversation(1, 'chat-model', 'responses')
    chat.updateConversation(conversation.id, { draftAttachments: [attachment] })
    await chat.send('secret', '')
    expect(chat.activeConversation.value?.title).toBe('notes.txt')
    expect(chat.activeConversation.value?.draftAttachments).toEqual([])
    expect(chat.activeConversation.value?.messages[0]).toMatchObject({ role: 'user', content: '', attachments: [attachment] })
    expect((storage.request.mock.calls[0]?.[0] as ChatRequest).messages[0]?.attachments).toEqual([attachment])
    await chat.send('secret', 'What was in that file?')
    expect((storage.request.mock.calls[1]?.[0] as ChatRequest).messages[0]?.attachments).toEqual([attachment])
    await chat.regenerate('secret')
    expect((storage.request.mock.calls[2]?.[0] as ChatRequest).messages[0]?.attachments).toEqual([attachment])
  })

  it('retains a stopped partial response in subsequent context and replaces only the last assistant on regeneration', async () => {
    const firstResponse = deferred<ChatReply>()
    let firstRequest!: ChatRequest
    storage.request.mockImplementationOnce((value: ChatRequest) => { firstRequest = value; return firstResponse.promise })
      .mockResolvedValue({ content: 'new answer', reasoning: '' })
    const chat = useChat(ref(1))
    cleanups.push(chat.dispose)
    await chat.load()
    const conversation = chat.createConversation(1, 'chat-model')
    const firstSend = chat.send('secret', 'first question')
    firstRequest.onUpdate?.({ content: 'partial answer', reasoning: '' })
    chat.stop()
    firstResponse.resolve({ content: 'must not replace stopped answer', reasoning: '' })
    await firstSend
    expect(chat.activeConversation.value?.messages[1]?.status).toBe('stopped')
    await chat.send('secret', 'next question')
    expect((storage.request.mock.calls[1]?.[0] as ChatRequest).messages.map(item => item.content))
      .toEqual(['first question', 'partial answer', 'next question'])
    await chat.regenerate('secret')
    expect((storage.request.mock.calls[2]?.[0] as ChatRequest).messages.map(item => item.content))
      .toEqual(['first question', 'partial answer', 'next question'])
    expect(chat.activeConversation.value?.messages.map(item => item.content))
      .toEqual(['first question', 'partial answer', 'next question', 'new answer'])
    expect(chat.activeId.value).toBe(conversation.id)
  })

  it('cannot resurrect a deleted running chat from late output or queued persistence', async () => {
    const response = deferred<ChatReply>()
    let request!: ChatRequest
    storage.request.mockImplementation((value: ChatRequest) => { request = value; return response.promise })
    const chat = useChat(ref(1))
    cleanups.push(chat.dispose)
    await chat.load()
    const conversation = chat.createConversation(1, 'chat-model')
    const sending = chat.send('secret', 'delete me')
    const deleting = chat.deleteConversation(conversation.id)
    request.onUpdate?.({ content: 'late output', reasoning: '' })
    response.resolve({ content: 'late output', reasoning: '' })
    await Promise.all([sending, deleting])
    expect(chat.conversations.value).toEqual([])
    expect(request.signal?.aborted).toBe(true)
    expect(storage.remove).toHaveBeenCalledWith(1, conversation.id)
    expect(JSON.stringify(storage.save.mock.calls)).not.toContain('late output')
  })

  it('saves interrupted output to its original account while suppressing stale callbacks after account change', async () => {
    const response = deferred<ChatReply>()
    let request!: ChatRequest
    storage.request.mockImplementation((value: ChatRequest) => { request = value; return response.promise })
    const user = ref(1)
    const chat = useChat(user)
    cleanups.push(chat.dispose)
    await chat.load()
    const conversation = chat.createConversation(1, 'chat-model')
    const sending = chat.send('secret', 'old account prompt')
    request.onUpdate?.({ content: 'partial', reasoning: '' })
    user.value = 2
    request.onUpdate?.({ content: 'stale', reasoning: '' })
    response.resolve({ content: 'stale', reasoning: '' })
    await Promise.all([sending, chat.load()])
    expect(chat.conversations.value).toEqual([])
    expect(storage.save.mock.calls.some(([owner, value]) => owner === 1 && value.id === conversation.id && value.messages[1]?.content === 'partial' && value.messages[1]?.status === 'stopped')).toBe(true)
    expect(storage.save.mock.calls.every(([owner, value]) => owner === value.userId)).toBe(true)
    expect(JSON.stringify(storage.save.mock.calls)).not.toContain('stale')
  })

  it('preserves assistant output and retries saving after persistence recovers', async () => {
    storage.save.mockRejectedValue(new Error('quota exceeded'))
    storage.request.mockResolvedValue({ content: 'real response', reasoning: '' })
    const chat = useChat(ref(1))
    cleanups.push(chat.dispose)
    await chat.load()
    chat.createConversation(1, 'chat-model')
    await chat.send('secret', 'hello')
    expect(chat.activeConversation.value?.messages[1]).toMatchObject({ content: 'real response', status: 'done' })
    expect(chat.historyError.value).toContain('quota exceeded')
    storage.save.mockResolvedValue(undefined)
    const saveCount = storage.save.mock.calls.length
    await chat.load()
    expect(chat.historyError.value).toBe('')
    expect(storage.save.mock.calls.slice(saveCount).map(([, conversation]) => conversation.messages.map((message: ChatConversation['messages'][number]) => message.content)))
      .toEqual([['hello', 'real response']])
    expect(chat.activeConversation.value?.messages[1]).toMatchObject({ content: 'real response', status: 'done' })
  })
})
