<template>
  <article class="chat-message-row select-text" :class="message.role === 'user' ? 'chat-message-user' : 'chat-message-assistant'" :aria-label="t(message.role === 'user' ? 'chat.you' : 'chat.assistant')" :aria-busy="message.status === 'streaming'">
    <div class="chat-message-content">
      <div v-if="message.role === 'user'" class="chat-user-bubble">
        <div v-if="message.attachments.length" class="chat-message-attachments" :class="message.content && 'mb-2'">
          <template v-for="attachment in message.attachments" :key="attachment.id">
            <a v-if="attachment.kind !== 'text'" :href="attachment.data" :download="attachment.name" class="chat-attachment-card" :class="attachment.kind === 'image' && 'chat-attachment-image'" :aria-label="t('chat.downloadAttachment', { name: attachment.name })" :title="attachment.name">
              <img v-if="attachment.kind === 'image'" :src="attachment.data" :alt="attachment.name" />
              <Icon v-else name="document" size="md" />
              <span v-if="attachment.kind !== 'image'" class="min-w-0">
                <span class="block truncate text-xs font-medium">{{ attachment.name }}</span>
                <span class="block text-[10px] opacity-70">{{ formatBytes(attachment.size, 1) }}</span>
              </span>
            </a>
            <button v-else type="button" class="chat-attachment-card" :aria-label="t('chat.downloadAttachment', { name: attachment.name })" :title="attachment.name" @click="downloadTextAttachment(attachment)">
              <Icon name="document" size="md" />
              <span class="min-w-0">
                <span class="block truncate text-xs font-medium">{{ attachment.name }}</span>
                <span class="block text-[10px] opacity-70">{{ formatBytes(attachment.size, 1) }}</span>
              </span>
            </button>
          </template>
        </div>
        <p v-if="message.content" class="whitespace-pre-wrap break-words text-sm leading-6">{{ message.content }}</p>
      </div>
      <template v-else>
        <details v-if="message.reasoning" class="mb-4 rounded-lg border border-gray-200 p-3 dark:border-dark-700">
          <summary class="cursor-pointer text-sm font-medium">{{ t('chat.reasoning') }}</summary>
          <div class="markdown-body mt-3 min-w-0 break-words" v-html="reasoningHtml" />
        </details>
        <div v-if="message.content" class="markdown-body min-w-0 break-words" v-html="contentHtml" />
        <p v-else-if="message.status === 'streaming'" class="text-sm text-gray-500 dark:text-gray-400">{{ t('chat.waitingReply') }}</p>
      </template>
      <p v-if="message.status === 'stopped'" class="mt-3 text-sm text-gray-500 dark:text-gray-400">{{ t('chat.stopped') }}</p>
      <p v-if="message.error || message.status === 'error'" role="alert" class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{{ message.error || t('chat.replyFailed') }}</p>
      <div class="chat-message-meta" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
        <span v-if="message.role === 'assistant' && message.model" class="truncate">{{ message.model }}</span>
        <span v-if="message.status === 'streaming'" class="chat-status" role="status">{{ t('chat.generating') }}</span>
        <time :datetime="new Date(message.createdAt).toISOString()">{{ timeLabel }}</time>
        <button v-if="message.content || message.reasoning || message.attachments.length" type="button" class="chat-message-action" :aria-label="t('chat.copyMessage')" :title="t('chat.copyMessage')" @click="copy"><Icon name="copy" size="sm" /></button>
        <button v-if="regeneratable" type="button" class="chat-message-action" :disabled="!canRegenerate" :aria-label="t('chat.regenerate')" :title="t('chat.regenerate')" @click="emit('regenerate')"><Icon name="refresh" size="sm" /></button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Icon from '@/components/icons/Icon.vue'
import { useClipboard } from '@/composables/useClipboard'
import { formatBytes } from '@/utils/format'
import '@/styles/announcement-markdown.css'
import type { ChatAttachment, ChatMessage } from './types'

const props = defineProps<{ message: ChatMessage; regeneratable: boolean; canRegenerate: boolean }>()
const emit = defineEmits<{ regenerate: [] }>()
const { t, locale } = useI18n()
const { copyToClipboard } = useClipboard()
const render = (content: string) => DOMPurify.sanitize(marked.parse(content, { async: false }) as string)
const contentHtml = computed(() => render(props.message.content))
const reasoningHtml = computed(() => render(props.message.reasoning))
const timeLabel = computed(() => new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit', hour12: false }).format(props.message.createdAt))
function copy() {
  const message = props.message
  const attachmentNames = message.attachments.map(attachment => attachment.name)
  const body = message.reasoning ? `${t('chat.reasoning')}\n${message.reasoning}\n\n${message.content}` : message.content
  const value = attachmentNames.length ? `${body}${body ? '\n\n' : ''}${t('chat.attachments')}: ${attachmentNames.join(', ')}` : body
  void copyToClipboard(value, t('chat.copied'))
}
function downloadTextAttachment(attachment: ChatAttachment) {
  const url = URL.createObjectURL(new Blob([attachment.data], { type: `${attachment.mimeType};charset=utf-8` }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = attachment.name
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.chat-message-row { display: flex; width: 100%; }
.chat-message-user { justify-content: flex-end; padding: 10px 0; }
.chat-message-assistant { justify-content: flex-start; padding: 12px 0; }
.chat-message-content { min-width: 0; max-width: 100%; }
.chat-message-user .chat-message-content { display: flex; max-width: min(78%, 680px); flex-direction: column; align-items: flex-end; }
.chat-message-assistant .chat-message-content { width: 100%; }
.chat-user-bubble { min-width: 0; max-width: 100%; padding: 12px 16px; border-radius: 20px 6px 20px 20px; background: rgba(23, 32, 51, .08); color: var(--app-text); }
.dark .chat-user-bubble { background: rgba(255, 255, 255, .17); }
.chat-message-meta { display: flex; min-height: 24px; max-width: 100%; align-items: center; gap: 8px; margin-top: 6px; color: var(--app-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.chat-message-action { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 6px; color: var(--app-muted); }
.chat-message-action:hover:not(:disabled), .chat-message-action:focus-visible { color: var(--app-text); background: var(--app-surface-soft); }
.chat-message-action:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 1px; }
.chat-message-action:disabled { opacity: .45; cursor: not-allowed; }
.chat-message-attachments { display: flex; max-width: 100%; flex-wrap: wrap; gap: 8px; }
.chat-attachment-card { display: flex; min-width: 0; max-width: 220px; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid rgba(127, 139, 170, .28); border-radius: 12px; background: rgba(255, 255, 255, .08); color: inherit; text-align: left; }
.chat-attachment-card:hover, .chat-attachment-card:focus-visible { border-color: var(--app-accent); }
.chat-attachment-card:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 2px; }
.chat-attachment-image { width: 112px; height: 84px; padding: 0; overflow: hidden; }
.chat-attachment-image img { width: 100%; height: 100%; object-fit: cover; }
.chat-status { color: var(--app-accent); }
.markdown-body :deep(> :first-child) { margin-top: 0; }
.markdown-body :deep(> :last-child) { margin-bottom: 0; }
.markdown-body :deep(table) { display: block; overflow-x: auto; }
.markdown-body :deep(pre) { max-width: 100%; }
@media (max-width: 639px) {
  .chat-message-user .chat-message-content { max-width: min(88%, 680px); }
}
</style>
