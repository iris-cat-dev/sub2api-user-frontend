<template>
  <div ref="root" class="chat-workspace card flex min-h-0 overflow-hidden" :style="{ height: panelHeight }" :inert="drawerOpen || undefined">
    <div v-if="desktop && !sidebarCollapsed" id="chat-conversation-sidebar" class="chat-sidebar w-64 shrink-0 border-r xl:w-72">
      <ChatConversationPane id="chat-desktop" :conversations="accountConversations" :active-id="activeId" :running-ids="runningIds" :loading="loading" :disabled="loading || !!historyError" @create="newConversation" @select="select" @rename="rename" @delete="deleteId = $event" />
    </div>
    <section class="flex min-h-0 min-w-0 flex-1 flex-col" :aria-label="t('chat.title')">
      <header class="chat-divider shrink-0 border-b px-3 py-2 sm:px-5">
        <div class="flex min-w-0 items-center gap-3">
          <button ref="sidebarButton" type="button" class="btn btn-secondary btn-sm shrink-0" :aria-label="desktop ? (sidebarCollapsed ? t('chat.showSidebar') : t('chat.hideSidebar')) : t('chat.openConversations')" :aria-expanded="desktop ? !sidebarCollapsed : drawerOpen" :aria-controls="desktop ? 'chat-conversation-sidebar' : 'chat-mobile-drawer'" @click="toggleSidebar"><Icon name="menu" size="sm" /></button>
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-base font-semibold">{{ activeConversation?.title || t('chat.title') }}</h1>
          </div>
        </div>
      </header>
      <div v-if="historyError" role="alert" class="shrink-0 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{{ t('chat.historyIssue', { message: historyError }) }} <button type="button" class="underline" :disabled="loading || runningIds.length > 0" @click="load">{{ t('chat.retryHistory') }}</button></div>
      <div ref="scrollContainer" class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain" :aria-label="t('chat.messages')" tabindex="0" @scroll.passive="onScroll">
        <div ref="messageContent" class="mx-auto w-full max-w-4xl px-3 py-5 sm:px-6">
          <p v-if="loading" role="status" class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{{ t('chat.loadingHistory') }}</p>
          <div v-else-if="!activeConversation?.messages.length" class="mx-auto flex max-w-xl flex-col items-center py-8 text-center sm:py-14">
            <span class="chat-empty-icon mb-5 rounded-2xl p-4"><Icon name="chat" size="xl" /></span>
            <h2 class="text-xl font-semibold sm:text-2xl">{{ t('chat.emptyTitle') }}</h2>
            <p class="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">{{ t('chat.emptyDescription') }}</p>
            <div class="mt-6 grid w-full gap-3 sm:grid-cols-2">
              <button v-for="suggestion in suggestionKeys" :key="suggestion" type="button" class="chat-suggestion rounded-xl border p-4 text-left text-sm" :disabled="!activeConversation || !!historyError" @click="useSuggestion(t(`chat.${suggestion}`))">{{ t(`chat.${suggestion}`) }}</button>
            </div>
          </div>
          <div v-else class="chat-message-list">
            <ChatMessageItem v-for="(message, index) in activeConversation.messages" :key="message.id" :message="message" :regeneratable="message.role === 'assistant' && index === activeConversation.messages.length - 1 && !running" :can-regenerate="ready" @regenerate="regenerateReply" />
            <button v-if="lastMessage?.role === 'user' && !running" type="button" class="btn btn-secondary btn-sm" :disabled="!ready" @click="regenerateReply">{{ t('chat.regenerate') }}</button>
          </div>
        </div>
      </div>
      <div class="relative shrink-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-4">
        <button v-if="!following && activeConversation?.messages.length" type="button" class="btn btn-secondary btn-sm absolute -top-12 left-1/2 -translate-x-1/2 shadow-sm" @click="jumpToLatest"><Icon name="arrowDown" size="sm" />{{ t('chat.latestMessage') }}</button>
        <form class="mx-auto max-w-4xl" @submit.prevent="sendDraft">
          <p v-if="formError" role="alert" class="mb-2 text-sm text-red-600 dark:text-red-400">{{ formError }}</p>
          <p v-if="attachmentError" id="chat-attachment-status" role="alert" class="mb-2 text-sm text-red-600 dark:text-red-400">{{ attachmentError }}</p>
          <label for="chat-draft" class="sr-only">{{ t('chat.message') }}</label>
          <div class="chat-composer-surface relative" :class="draggingFiles && 'chat-composer-dragging'" @dragenter.prevent="draggingFiles = true" @dragover.prevent="draggingFiles = true" @dragleave.prevent="onAttachmentDragLeave" @drop.prevent="onAttachmentDrop">
            <div v-if="draggingFiles" class="chat-drop-overlay pointer-events-none" aria-hidden="true">{{ t('chat.dropFiles') }}</div>
            <div v-if="draftAttachments.length" class="chat-draft-attachments" :aria-label="t('chat.attachments')">
              <div v-for="attachment in draftAttachments" :key="attachment.id" class="chat-draft-attachment">
                <img v-if="attachment.kind === 'image'" :src="attachment.data" :alt="attachment.name" />
                <span v-else class="chat-draft-file-icon"><Icon name="document" size="sm" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-medium">{{ attachment.name }}</span>
                  <span class="block text-[10px] text-gray-500 dark:text-gray-400">{{ formatBytes(attachment.size, 1) }}</span>
                </span>
                <button type="button" class="chat-remove-attachment" :disabled="running || readingAttachments" :aria-label="t('chat.removeAttachment', { name: attachment.name })" :title="t('chat.removeAttachment', { name: attachment.name })" @click="removeAttachment(attachment.id)"><Icon name="x" size="xs" /></button>
              </div>
            </div>
            <textarea id="chat-draft" ref="composer" v-model="draft" rows="1" class="chat-draft" :disabled="!activeConversation || loading || !!historyError" :placeholder="t('chat.messagePlaceholder')" aria-describedby="chat-composer-status chat-attachment-status chat-composer-hint" @keydown="onComposerKeydown" @paste="onComposerPaste" @compositionstart="composing = true" @compositionend="composing = false" />
            <div class="chat-composer-toolbar">
              <input ref="fileInput" type="file" class="sr-only" multiple :accept="CHAT_ATTACHMENT_ACCEPT" :disabled="!canChooseAttachments" tabindex="-1" @change="onAttachmentInput" />
              <button type="button" class="chat-attach-button" :disabled="!canChooseAttachments" :aria-label="t('chat.addFiles')" :title="t('chat.addFiles')" @click="fileInput?.click()"><Icon :name="readingAttachments ? 'refresh' : 'document'" size="sm" :class="readingAttachments && 'animate-spin'" /></button>
              <div :key="activeId || ''" class="chat-composer-pickers" role="group" :aria-label="t('chat.composerControls')">
                <Select id="chat-key" v-model="selectedKeyId" class="chat-picker chat-key-picker" :options="keyOptions" :disabled="loadingKeys || running || !activeConversation || loading" :searchable="true" :search-placeholder="t('chat.searchKeys')" :empty-text="t('chat.noKeys')" :aria-label="`${t('chat.key')}: ${keyLabel}`" :title="keyLabel" @change="nextTick(() => composer?.focus())">
                  <template #selected>
                    <span class="chat-picker-value"><Icon :name="loadingKeys ? 'refresh' : 'key'" size="sm" :class="loadingKeys && 'animate-spin'" /><span class="chat-key-label truncate">{{ selectedKey?.name || t('chat.keyShort') }}</span></span>
                  </template>
                  <template #footer="{ close }">
                    <p v-if="keysError || keyReason" role="alert" class="mb-2 text-xs leading-5 text-red-600 dark:text-red-400">{{ keysError || keyReason }}</p>
                    <div class="chat-picker-actions">
                      <button type="button" class="chat-picker-action" :disabled="loadingKeys || running" @click="close(); loadKeys(); nextTick(() => composer?.focus())"><Icon name="refresh" size="sm" />{{ t('chat.refreshKeys') }}</button>
                      <RouterLink class="chat-link text-xs" to="/keys">{{ t('chat.manageKeys') }}</RouterLink>
                    </div>
                  </template>
                </Select>
                <Select id="chat-model" v-model="model" class="chat-picker chat-model-picker" :options="modelOptions" :disabled="!activeConversation || running || loading" :searchable="true" :search-placeholder="t('chat.searchModels')" :empty-text="t('chat.noMatchingModels')" :loading="loadingModels" :aria-label="`${t('chat.model')}: ${model || t('chat.selectModel')}`" :title="model || t('chat.selectModel')" @change="manualModelId = ''; nextTick(() => composer?.focus())">
                  <template #selected>
                    <span class="chat-picker-value"><Icon v-if="loadingModels || !model" :name="loadingModels ? 'refresh' : 'cpu'" size="sm" :class="loadingModels && 'animate-spin'" /><ModelIcon v-else :model="model" size="16px" class="shrink-0" /><span class="truncate">{{ model || t('chat.model') }}</span></span>
                  </template>
                  <template #option="{ option, selected }">
                    <ModelIcon :model="String(option.value)" size="16px" class="shrink-0" />
                    <span class="select-option-label" :title="option.label">{{ option.label }}</span>
                    <Icon v-if="selected" name="check" size="sm" class="shrink-0 text-primary-500" />
                  </template>
                  <template #footer="{ select: selectModel, close }">
                    <p v-if="modelsError" role="alert" class="mb-2 text-xs leading-5 text-red-600 dark:text-red-400">{{ modelsError }} {{ t('chat.customModelHint') }}</p>
                    <p v-else-if="missingModel" class="mb-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{{ t('chat.savedModelWarning', { model }) }}</p>
                    <label for="chat-custom-model" class="chat-manual-label">{{ t('chat.customModel') }}</label>
                    <div class="chat-manual-model">
                      <input id="chat-custom-model" v-model="manualModelId" type="text" class="input" :placeholder="t('chat.customModelPlaceholder')" autocomplete="off" :disabled="running || loading" @keydown.enter="applyCustomModel(selectModel, $event)" />
                      <button type="button" class="chat-picker-action chat-apply-model" :aria-label="t('chat.applyModel')" :title="t('chat.applyModel')" :disabled="!manualModelId.trim() || running || loading" @click="applyCustomModel(selectModel)"><Icon name="check" size="sm" /></button>
                    </div>
                    <button type="button" class="chat-picker-action mt-2" :disabled="!usableKey || loadingModels || running" @click="close(); loadModels(); nextTick(() => composer?.focus())"><Icon name="refresh" size="sm" :class="loadingModels && 'animate-spin'" />{{ t('chat.refreshModels') }}</button>
                  </template>
                </Select>
                <Select id="chat-protocol" v-model="protocol" class="chat-picker chat-protocol-picker" :options="protocolOptions" :disabled="!activeConversation || running || loading" :searchable="false" :aria-label="`${t('chat.protocol')}: ${protocolLabel}`" :title="protocolLabel" @change="nextTick(() => composer?.focus())">
                  <template #selected>
                    <span class="chat-picker-value"><Icon name="server" size="sm" /><span class="chat-protocol-label truncate">{{ protocol === 'chat-completions' ? 'Chat' : protocol === 'responses' ? 'Responses' : 'Messages' }}</span></span>
                  </template>
                  <template #footer><p class="text-xs leading-5 text-gray-500 dark:text-gray-400">{{ t('chat.protocolHint') }}</p></template>
                </Select>
              </div>
              <button v-if="running" type="button" class="btn btn-secondary chat-send-button" :aria-label="t('chat.stop')" :title="t('chat.stop')" @click="stop()"><span class="h-3 w-3 rounded-sm bg-current" aria-hidden="true" /></button>
              <button v-else type="submit" class="btn btn-primary chat-send-button" :disabled="!canSend" :aria-label="t('chat.send')" :title="t('chat.send')"><Icon name="arrowUp" size="sm" /></button>
            </div>
          </div>
          <span v-if="blockingReason" id="chat-composer-status" class="sr-only" role="status">{{ blockingReason }}</span>
          <p id="chat-composer-hint" class="mt-2 text-center text-[11px] text-gray-500 dark:text-gray-400">{{ t('chat.composerHint') }}</p>
        </form>
      </div>
    </section>
  </div>
  <Teleport to="body">
    <div v-if="drawerOpen" class="fixed inset-0 z-[60] bg-black/50" @click.self="closeDrawer()">
      <div id="chat-mobile-drawer" ref="drawer" role="dialog" aria-modal="true" :aria-label="t('chat.conversations')" class="chat-drawer h-full w-[min(88vw,340px)] shadow-xl" @keydown="onDrawerKeydown">
        <ChatConversationPane id="chat-mobile" :conversations="accountConversations" :active-id="activeId" :running-ids="runningIds" :loading="loading" :disabled="loading || !!historyError" @create="newConversation" @select="select" @rename="rename" @delete="requestDeleteFromDrawer">
          <template #close><button type="button" class="btn btn-secondary btn-sm" :aria-label="t('chat.closeConversations')" @click="closeDrawer()"><Icon name="x" size="sm" /></button></template>
        </ChatConversationPane>
      </div>
    </div>
  </Teleport>
  <ConfirmDialog :show="deleteId !== null" :title="t('chat.deleteConversation')" :message="t('chat.confirmDelete', { title: deletingTitle })" :confirm-text="t('chat.delete')" :cancel-text="t('chat.cancel')" danger @confirm="confirmDelete" @cancel="deleteId = null" />
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { keysAPI } from '@/api/keys'
import type { ApiKey } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import Select from '@/components/common/Select.vue'
import type { SelectOption } from '@/components/common/Select.vue'
import ModelIcon from '@/components/common/ModelIcon.vue'
import ChatConversationPane from './ChatConversationPane.vue'
import ChatMessageItem from './ChatMessageItem.vue'
import { listChatModels } from './client'
import { CHAT_ATTACHMENT_ACCEPT, MAX_CHAT_ATTACHMENTS_PER_MESSAGE, MAX_CHAT_ATTACHMENT_CONTEXT_BYTES, chatAttachmentSpec, maxChatAttachmentBytes, readChatAttachment } from './attachments'
import { useChat } from './useChat'
import { formatBytes } from '@/utils/format'
import type { ChatAttachment, ChatProtocol } from './types'

const props = defineProps<{ userId: number }>()
const { t } = useI18n()
const { conversations, activeId, loading, historyError, runningIds, activeConversation: rawActiveConversation, load, createConversation, selectConversation, updateConversation, deleteConversation, send, regenerate, stop, dispose } = useChat(toRef(props, 'userId'))
const activeConversation = computed(() => rawActiveConversation.value?.userId === props.userId ? rawActiveConversation.value : null)
const accountConversations = computed(() => conversations.value.filter(item => item.userId === props.userId))
const keys = ref<ApiKey[]>([])
const loadingKeys = ref(false)
const keysError = ref('')
const models = ref<string[]>([])
const loadingModels = ref(false)
const modelsError = ref('')
const modelsLoaded = ref(false)
const manualModelId = ref('')
const formError = ref('')
const attachmentError = ref('')
const readingAttachments = ref(false)
const draggingFiles = ref(false)
const root = ref<HTMLElement | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)
const messageContent = ref<HTMLElement | null>(null)
const composer = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const drawer = ref<HTMLElement | null>(null)
const sidebarButton = ref<HTMLButtonElement | null>(null)
const desktop = ref(false)
const sidebarCollapsed = ref(false)
const drawerOpen = ref(false)
const panelHeight = ref('calc(100dvh - 160px)')
const following = ref(true)
const deleteId = ref<string | null>(null)
const composing = ref(false)
const suggestionKeys = ['suggestExplain', 'suggestWrite', 'suggestCode', 'suggestPlan'] as const
const scrollPositions = new Map<string, { top: number; following: boolean }>()
let keyController: AbortController | null = null
let modelController: AbortController | null = null
let keysRevision = 0
let modelsRevision = 0
let accountRevision = 0
let disposed = false
let previousFocus: HTMLElement | null = null
let previousOverflow = ''
let layoutObserver: ResizeObserver | null = null
let messagesObserver: ResizeObserver | null = null
let media: MediaQueryList | null = null

const selectedKey = computed(() => keys.value.find(key => key.id === activeConversation.value?.keyId))
const missingSavedKey = computed(() => !loadingKeys.value && activeConversation.value?.keyId != null && !selectedKey.value)
function invalidReason(key: ApiKey): string {
  if (key.status !== 'active') return t(`chat.keyStatus.${key.status}`)
  if (key.expires_at && Date.parse(key.expires_at) <= Date.now()) return t('chat.keyStatus.expired')
  if (key.quota > 0 && key.quota_used >= key.quota) return t('chat.keyStatus.quota_exhausted')
  if (key.group_id == null || !key.group) return t('chat.unboundKey')
  if (key.group.status !== 'active') return t('chat.inactiveGroup', { group: key.group.name })
  if (!key.key.trim()) return t('chat.missingKeyValue')
  return ''
}
const keyReason = computed(() => missingSavedKey.value ? t('chat.savedKeyMissing') : selectedKey.value ? invalidReason(selectedKey.value) : '')
const usableKey = computed(() => selectedKey.value && !keyReason.value ? selectedKey.value : null)
const running = computed(() => !!activeConversation.value && runningIds.value.includes(activeConversation.value.id))
function defaultProtocol(key?: ApiKey): ChatProtocol {
  const platform = key?.group?.platform
  return platform === 'openai' || platform === 'grok' ? 'responses' : platform === 'anthropic' ? 'messages' : 'chat-completions'
}
const selectedKeyId = computed({
  get: () => activeConversation.value?.keyId == null ? '' : String(activeConversation.value.keyId),
  set: value => {
    const conversation = activeConversation.value
    if (!conversation || running.value) return
    const key = keys.value.find(item => String(item.id) === value)
    updateConversation(conversation.id, { keyId: key?.id ?? null, protocol: defaultProtocol(key) })
  }
})
const model = computed({ get: () => activeConversation.value?.model || '', set: value => { if (activeConversation.value && !running.value) updateConversation(activeConversation.value.id, { model: value }) } })
const protocol = computed({ get: () => activeConversation.value?.protocol || 'chat-completions', set: (value: ChatProtocol) => { if (activeConversation.value && !running.value) updateConversation(activeConversation.value.id, { protocol: value }) } })
const draft = computed({ get: () => activeConversation.value?.draft || '', set: value => { if (activeConversation.value) updateConversation(activeConversation.value.id, { draft: value }) } })
const draftAttachments = computed(() => activeConversation.value?.draftAttachments ?? [])
const sentAttachmentBytes = computed(() => activeConversation.value?.messages.reduce((total, message) => total + message.attachments.reduce((sum, attachment) => sum + attachment.size, 0), 0) ?? 0)
const keyOptions = computed<SelectOption[]>(() => {
  const options = keys.value.map(key => {
    const reason = invalidReason(key)
    return { value: String(key.id), label: `${key.name} · ${key.group?.name || t('chat.unboundGroup')}${reason ? ` — ${reason}` : ''}`, disabled: !!reason }
  })
  if (missingSavedKey.value) options.unshift({ value: String(activeConversation.value?.keyId), label: t('chat.missingKeyOption', { id: activeConversation.value?.keyId }), disabled: true })
  return options
})
const keyLabel = computed(() => keyOptions.value.find(option => option.value === selectedKeyId.value)?.label || t('chat.selectKey'))
const modelOptions = computed<SelectOption[]>(() => {
  const options = models.value.map(value => ({ value, label: value }))
  if (model.value && !models.value.includes(model.value)) options.unshift({ value: model.value, label: model.value })
  return options
})
const protocolOptions = computed<SelectOption[]>(() => [
  { value: 'responses', label: t('chat.protocolResponses') },
  { value: 'messages', label: t('chat.protocolMessages') },
  { value: 'chat-completions', label: t('chat.protocolCompletions') },
])
const missingModel = computed(() => modelsLoaded.value && !!model.value.trim() && !models.value.includes(model.value))
const lastMessage = computed(() => activeConversation.value?.messages[activeConversation.value.messages.length - 1])
const blockingReason = computed(() => {
  if (loading.value) return t('chat.loadingHistory')
  if (historyError.value) return t('chat.historyUnavailable')
  if (loadingKeys.value) return t('chat.loadingKeys')
  if (keysError.value) return keysError.value
  if (keyReason.value) return keyReason.value
  if (!usableKey.value) return t('chat.chooseKeyHint')
  if (loadingModels.value) return t('chat.loadingModels')
  if (!model.value.trim()) return t('chat.chooseModelHint')
  if (readingAttachments.value) return t('chat.readingAttachments')
  return ''
})
const ready = computed(() => !!activeConversation.value && !blockingReason.value && !running.value)
const canChooseAttachments = computed(() => !!activeConversation.value && !loading.value && !historyError.value && !running.value && !readingAttachments.value && draftAttachments.value.length < MAX_CHAT_ATTACHMENTS_PER_MESSAGE && sentAttachmentBytes.value + draftAttachments.value.reduce((total, attachment) => total + attachment.size, 0) < MAX_CHAT_ATTACHMENT_CONTEXT_BYTES)
const canSend = computed(() => ready.value && (!!draft.value.trim() || draftAttachments.value.length > 0))
const deletingTitle = computed(() => accountConversations.value.find(item => item.id === deleteId.value)?.title || t('chat.untitled'))
const protocolLabel = computed(() => protocolOptions.value.find(option => option.value === protocol.value)?.label || '')
function errorMessage(error: unknown) { return error instanceof Error ? error.message : t('chat.unexpected') }

function applyCustomModel(selectModel: (option: SelectOption) => void, event?: KeyboardEvent) {
  if (event?.isComposing || event?.keyCode === 229 || running.value || loading.value) return
  event?.preventDefault()
  const value = manualModelId.value.trim()
  if (value) selectModel({ value, label: value })
}
function attachmentFailure(message: string) {
  if (!attachmentError.value) attachmentError.value = message
}
async function addAttachments(files: File[]) {
  const conversation = activeConversation.value
  if (!conversation || running.value || loading.value || historyError.value || readingAttachments.value || !files.length) return
  attachmentError.value = ''
  const revision = accountRevision
  const conversationId = conversation.id
  const remaining = MAX_CHAT_ATTACHMENTS_PER_MESSAGE - draftAttachments.value.length
  if (remaining <= 0) {
    attachmentFailure(t('chat.tooManyAttachments', { count: MAX_CHAT_ATTACHMENTS_PER_MESSAGE }))
    return
  }
  if (files.length > remaining) attachmentFailure(t('chat.tooManyAttachments', { count: MAX_CHAT_ATTACHMENTS_PER_MESSAGE }))
  const accepted: ChatAttachment[] = []
  let contextBytes = sentAttachmentBytes.value + draftAttachments.value.reduce((total, attachment) => total + attachment.size, 0)
  readingAttachments.value = true
  try {
    for (const file of files.slice(0, remaining)) {
      const spec = chatAttachmentSpec(file)
      if (!spec) {
        attachmentFailure(t('chat.unsupportedAttachment', { name: file.name }))
        continue
      }
      if (file.size <= 0) {
        attachmentFailure(t('chat.emptyAttachment', { name: file.name }))
        continue
      }
      const maxBytes = maxChatAttachmentBytes(spec.kind)
      if (file.size > maxBytes) {
        attachmentFailure(t('chat.attachmentTooLarge', { name: file.name, max: formatBytes(maxBytes, 0) }))
        continue
      }
      if (contextBytes + file.size > MAX_CHAT_ATTACHMENT_CONTEXT_BYTES) {
        attachmentFailure(t('chat.attachmentContextTooLarge', { max: formatBytes(MAX_CHAT_ATTACHMENT_CONTEXT_BYTES, 0) }))
        continue
      }
      try {
        const attachment = await readChatAttachment(file, spec)
        if (disposed || revision !== accountRevision || props.userId !== conversation.userId || activeId.value !== conversationId) return
        accepted.push(attachment)
        contextBytes += attachment.size
      } catch {
        attachmentFailure(t('chat.readAttachmentFailed', { name: file.name }))
      }
    }
    if (accepted.length && !disposed && revision === accountRevision && activeId.value === conversationId) {
      updateConversation(conversationId, { draftAttachments: [...draftAttachments.value, ...accepted] })
    }
  } finally {
    readingAttachments.value = false
  }
}
function removeAttachment(id: string) {
  const conversation = activeConversation.value
  if (!conversation || running.value || readingAttachments.value) return
  updateConversation(conversation.id, { draftAttachments: draftAttachments.value.filter(attachment => attachment.id !== id) })
  attachmentError.value = ''
}
function onAttachmentInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  void addAttachments(files)
}
function onComposerPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.files ?? [])
  if (!files.length) return
  event.preventDefault()
  void addAttachments(files)
}
function onAttachmentDrop(event: DragEvent) {
  draggingFiles.value = false
  void addAttachments(Array.from(event.dataTransfer?.files ?? []))
}
function onAttachmentDragLeave(event: DragEvent) {
  const relatedTarget = event.relatedTarget
  if (!(relatedTarget instanceof Node) || !(event.currentTarget as HTMLElement).contains(relatedTarget)) draggingFiles.value = false
}

async function loadKeys() {
  keyController?.abort()
  const controller = new AbortController()
  keyController = controller
  const revision = ++keysRevision
  const userId = props.userId
  loadingKeys.value = true
  keysError.value = ''
  try {
    const found: ApiKey[] = []
    for (let page = 1; ; page++) {
      const response = await keysAPI.list(page, 100, undefined, { signal: controller.signal })
      if (disposed || controller.signal.aborted || revision !== keysRevision || userId !== props.userId) return
      found.push(...response.items.filter(key => key.user_id === userId))
      if (page >= response.pages || response.items.length === 0) break
    }
    keys.value = found
  } catch (error) {
    if (!disposed && !controller.signal.aborted && revision === keysRevision && userId === props.userId) keysError.value = t('chat.loadKeysFailed', { message: errorMessage(error) })
  } finally {
    if (!disposed && revision === keysRevision && userId === props.userId) loadingKeys.value = false
  }
}
async function loadModels() {
  modelController?.abort()
  const controller = new AbortController()
  modelController = controller
  const revision = ++modelsRevision
  const userId = props.userId
  const key = usableKey.value
  models.value = []
  modelsError.value = ''
  modelsLoaded.value = false
  loadingModels.value = false
  if (!key) return
  loadingModels.value = true
  try {
    const names = await listChatModels(key.key, controller.signal)
    if (disposed || controller.signal.aborted || revision !== modelsRevision || userId !== props.userId || usableKey.value?.id !== key.id) return
    models.value = [...new Set(names.filter(name => typeof name === 'string' && name.trim()))]
    modelsLoaded.value = true
    if (!models.value.length) modelsError.value = t('chat.noModels')
  } catch (error) {
    if (!disposed && !controller.signal.aborted && revision === modelsRevision && userId === props.userId) modelsError.value = t('chat.loadModelsFailed', { message: errorMessage(error) })
  } finally {
    if (!disposed && revision === modelsRevision && userId === props.userId) loadingModels.value = false
  }
}
watch(() => props.userId, () => {
  accountRevision++
  keysRevision++
  modelsRevision++
  keyController?.abort()
  modelController?.abort()
  keys.value = []
  models.value = []
  keysError.value = ''
  modelsError.value = ''
  modelsLoaded.value = false
  loadingModels.value = false
  manualModelId.value = ''
  formError.value = ''
  attachmentError.value = ''
  draggingFiles.value = false
  deleteId.value = null
  scrollPositions.clear()
  following.value = true
  closeDrawer(false)
  void loadKeys()
}, { immediate: true, flush: 'sync' })
watch(() => usableKey.value, () => { void loadModels() }, { flush: 'sync' })
watch([loading, historyError], () => {
  if (!loading.value && !historyError.value && !accountConversations.value.length) createConversation()
}, { immediate: true })
function newConversation() {
  if (loading.value || historyError.value) return
  createConversation(usableKey.value?.id ?? null, model.value, defaultProtocol(usableKey.value ?? undefined))
  closeDrawer()
  void nextTick(() => composer.value?.focus())
}
function select(id: string) { selectConversation(id); closeDrawer() }
function rename(id: string, title: string) { updateConversation(id, { title }) }
function requestDeleteFromDrawer(id: string) { closeDrawer(); deleteId.value = id }
async function confirmDelete() {
  const id = deleteId.value
  const revision = accountRevision
  deleteId.value = null
  if (!id) return
  try { await deleteConversation(id) } catch (error) {
    if (revision === accountRevision && !disposed) formError.value = t('chat.deleteFailed', { message: errorMessage(error) })
  }
  if (revision === accountRevision && !disposed && !accountConversations.value.length && !historyError.value) createConversation()
}
async function sendDraft() {
  const key = usableKey.value
  if (!canSend.value || !key) return
  const id = activeId.value
  const revision = accountRevision
  formError.value = ''
  jumpToLatest()
  try { await send(key.key, draft.value) } catch (error) {
    if (!disposed && revision === accountRevision && activeId.value === id) formError.value = t('chat.sendFailed', { message: errorMessage(error) })
  }
}
async function regenerateReply() {
  const key = usableKey.value
  if (!ready.value || !key) return
  const id = activeId.value
  const revision = accountRevision
  formError.value = ''
  jumpToLatest()
  try { await regenerate(key.key) } catch (error) {
    if (!disposed && revision === accountRevision && activeId.value === id) formError.value = t('chat.sendFailed', { message: errorMessage(error) })
  }
}
function useSuggestion(value: string) { draft.value = value; void nextTick(() => composer.value?.focus()) }
function onComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing.value && event.keyCode !== 229) {
    event.preventDefault()
    void sendDraft()
  }
}
function resizeComposer() {
  const element = composer.value
  if (!element) return
  element.style.height = 'auto'
  const maxHeight = Math.max(48, Math.min(160, (root.value?.clientHeight ?? 480) / 3))
  element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`
  element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
}
watch(draft, () => { void nextTick(resizeComposer) })
function onScroll() {
  const element = scrollContainer.value
  if (!element) return
  following.value = element.scrollHeight - element.scrollTop - element.clientHeight < 64
  if (activeId.value) scrollPositions.set(activeId.value, { top: element.scrollTop, following: following.value })
}
function followBottom() { if (following.value && scrollContainer.value) scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight }
function jumpToLatest() { following.value = true; void nextTick(followBottom) }
watch(activeId, async (id, previousId) => {
  if (previousId && scrollContainer.value) scrollPositions.set(previousId, { top: scrollContainer.value.scrollTop, following: following.value })
  formError.value = ''
  manualModelId.value = ''
  attachmentError.value = ''
  draggingFiles.value = false
  composing.value = false
  const position = id ? scrollPositions.get(id) : undefined
  following.value = position?.following ?? true
  await nextTick()
  if (disposed || activeId.value !== id) return
  if (scrollContainer.value) scrollContainer.value.scrollTop = following.value ? scrollContainer.value.scrollHeight : position?.top ?? 0
  resizeComposer()
}, { flush: 'pre' })
watch(() => [activeConversation.value?.messages.length, lastMessage.value?.content, lastMessage.value?.reasoning, lastMessage.value?.status, lastMessage.value?.error], () => { void nextTick(followBottom) })
function updateLayout() {
  if (!root.value) return
  const viewport = window.visualViewport
  const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight
  const parent = root.value.closest('.app-main')
  const padding = parent ? parseFloat(getComputedStyle(parent).paddingBottom) || 0 : 16
  panelHeight.value = `${Math.max(180, bottom - root.value.getBoundingClientRect().top - padding)}px`
  resizeComposer()
}
function updateMedia() { desktop.value = media?.matches ?? false; if (desktop.value) closeDrawer() }
function toggleSidebar() { if (desktop.value) sidebarCollapsed.value = !sidebarCollapsed.value; else openDrawer() }
async function openDrawer() {
  previousFocus = document.activeElement as HTMLElement | null
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  drawerOpen.value = true
  await nextTick()
  drawer.value?.querySelector<HTMLElement>('button, input')?.focus()
}
function closeDrawer(restoreFocus = true) {
  if (!drawerOpen.value) return
  drawerOpen.value = false
  document.body.style.overflow = previousOverflow
  const focusTarget = previousFocus?.isConnected ? previousFocus : sidebarButton.value
  if (restoreFocus) void nextTick(() => focusTarget?.focus())
  previousFocus = null
}
function onDrawerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeDrawer(); return }
  if (event.key !== 'Tab') return
  const focusable = Array.from(drawer.value?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') ?? [])
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(() => {
  media = window.matchMedia('(min-width: 1024px)')
  updateMedia()
  media.addEventListener('change', updateMedia)
  window.addEventListener('resize', updateLayout)
  window.visualViewport?.addEventListener('resize', updateLayout)
  window.visualViewport?.addEventListener('scroll', updateLayout)
  if (typeof ResizeObserver !== 'undefined') {
    layoutObserver = new ResizeObserver(updateLayout)
    if (root.value?.parentElement) layoutObserver.observe(root.value.parentElement)
    messagesObserver = new ResizeObserver(followBottom)
    if (messageContent.value) messagesObserver.observe(messageContent.value)
  }
  updateLayout()
  resizeComposer()
})
onBeforeUnmount(() => {
  disposed = true
  keyController?.abort()
  modelController?.abort()
  closeDrawer(false)
  dispose()
  layoutObserver?.disconnect()
  messagesObserver?.disconnect()
  media?.removeEventListener('change', updateMedia)
  window.removeEventListener('resize', updateLayout)
  window.visualViewport?.removeEventListener('resize', updateLayout)
  window.visualViewport?.removeEventListener('scroll', updateLayout)
})
</script>

<style scoped>
.chat-workspace { color: var(--app-text); background: var(--app-surface); }
.chat-sidebar, .chat-drawer { background: var(--app-surface); color: var(--app-text); border-color: var(--app-border); }
.chat-divider, .chat-suggestion { border-color: var(--app-border); }
.chat-suggestion { background: var(--app-surface-soft); transition: border-color .15s; }
.chat-suggestion:hover, .chat-suggestion:focus-visible { border-color: var(--app-accent); }
.chat-empty-icon { background: var(--app-surface-soft); color: var(--app-accent); }
.chat-link { color: var(--app-accent); text-decoration: underline; }
.chat-composer-surface { padding: 10px; border: 1px solid var(--app-border); border-radius: 18px; background: var(--app-surface-soft); transition: border-color .15s; }
.chat-composer-dragging { border-color: var(--app-accent); background: color-mix(in srgb, var(--app-accent) 8%, var(--app-surface-soft)); }
.chat-drop-overlay { position: absolute; inset: 6px; z-index: 2; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--app-accent); border-radius: 13px; background: color-mix(in srgb, var(--app-surface) 88%, transparent); color: var(--app-accent); font-size: 13px; font-weight: 600; }
.chat-draft-attachments { display: flex; max-height: 112px; overflow: auto; flex-wrap: wrap; gap: 6px; padding: 1px 1px 7px; }
.chat-draft-attachment { display: flex; min-width: 0; width: min(220px, 100%); height: 42px; align-items: center; gap: 7px; padding: 4px 5px; border: 1px solid var(--app-border); border-radius: 10px; background: var(--app-surface); }
.chat-draft-attachment > img, .chat-draft-file-icon { width: 32px; height: 32px; flex-shrink: 0; border-radius: 7px; }
.chat-draft-attachment > img { object-fit: cover; }
.chat-draft-file-icon { display: flex; align-items: center; justify-content: center; background: var(--app-surface-soft); color: var(--app-muted); }
.chat-remove-attachment { display: inline-flex; width: 24px; height: 24px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 6px; color: var(--app-muted); }
.chat-remove-attachment:hover:not(:disabled), .chat-remove-attachment:focus-visible { color: var(--app-text); background: var(--app-surface-soft); }
.chat-remove-attachment:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 1px; }
.chat-remove-attachment:disabled { opacity: .45; cursor: not-allowed; }
.chat-composer-surface:focus-within { border-color: var(--app-accent); }
.chat-composer-surface .chat-draft { display: block; width: 100%; min-height: 52px; padding: 5px 4px 8px; border: 0; border-radius: 0; background: transparent; color: var(--app-text); font-size: 16px; line-height: 1.6; resize: none; outline: none; box-shadow: none; }
.chat-draft::placeholder { color: var(--app-muted); }
.chat-composer-toolbar { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.chat-attach-button { display: inline-flex; width: 30px; height: 30px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 8px; color: var(--app-muted); }
.chat-attach-button:hover:not(:disabled), .chat-attach-button:focus-visible { color: var(--app-text); background: var(--app-surface); border-color: var(--app-border); }
.chat-attach-button:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 2px; }
.chat-attach-button:disabled { opacity: .45; cursor: not-allowed; }
.chat-composer-pickers { display: flex; flex: 1; align-items: center; gap: 2px; min-width: 0; }
.chat-picker { min-width: 0; }
.chat-model-picker { flex: 0 1 auto; max-width: 320px; }
.chat-key-picker { flex-shrink: 0; max-width: 140px; }
.chat-protocol-picker { flex-shrink: 0; max-width: 145px; }
.chat-picker :deep(.select-trigger) { height: 30px; gap: 4px; padding: 0 6px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--app-muted); font-size: 12px; box-shadow: none; }
.chat-picker :deep(.select-trigger:hover:not(:disabled)), .chat-picker :deep(.select-trigger-open), .chat-picker :deep(.select-trigger:focus-visible) { color: var(--app-text); background: var(--app-surface); border-color: var(--app-border); }
.chat-picker :deep(.select-trigger:focus-visible) { outline: 2px solid var(--app-accent); outline-offset: 2px; }
.chat-picker :deep(.select-icon svg) { width: 12px; height: 12px; }
.chat-picker-value { display: flex; align-items: center; gap: 5px; min-width: 0; }
.chat-picker-value > svg { flex-shrink: 0; }
.chat-composer-toolbar .chat-send-button { width: 34px; height: 34px; min-height: 34px; padding: 0; flex-shrink: 0; border-radius: 10px; }
.chat-picker-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.chat-picker-action { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 30px; padding: 4px 6px; border-radius: 6px; color: var(--app-muted); font-size: 12px; }
.chat-picker-action:hover:not(:disabled), .chat-picker-action:focus-visible { color: var(--app-accent); background: var(--app-surface-soft); }
.chat-picker-action:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 2px; }
.chat-picker-action:disabled { opacity: .5; cursor: not-allowed; }
.chat-manual-label { display: block; margin-bottom: 6px; color: var(--app-muted); font-size: 12px; }
.chat-manual-model { display: flex; align-items: center; gap: 6px; }
.chat-manual-model .input { flex: 1; min-width: 0; height: 34px; padding: 4px 8px; font-size: 16px; }
.chat-apply-model { width: 30px; padding: 4px; flex-shrink: 0; }
@media (max-width: 639px) {
  .chat-key-label, .chat-protocol-label { display: none; }
}
@media (min-width: 640px) {
  .chat-composer-surface .chat-draft, .chat-manual-model .input { font-size: 14px; }
}
</style>
