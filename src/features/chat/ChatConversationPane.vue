<template>
  <section class="flex h-full min-h-0 flex-col" :aria-label="t('chat.conversations')">
    <div class="space-y-3 border-b border-gray-200 p-4 dark:border-dark-700">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">{{ t('chat.conversations') }}</h2>
        <slot name="close" />
      </div>
      <button type="button" class="btn btn-primary w-full" :disabled="disabled" @click="emit('create')">{{ t('chat.newConversation') }}</button>
      <label class="sr-only" :for="`${id}-search`">{{ t('chat.searchConversations') }}</label>
      <input :id="`${id}-search`" v-model="search" type="search" class="input" :placeholder="t('chat.searchConversations')" />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <p v-if="loading" class="p-4 text-sm text-gray-500 dark:text-gray-400" role="status">{{ t('chat.loadingHistory') }}</p>
      <p v-else-if="!filtered.length" class="p-4 text-sm text-gray-500 dark:text-gray-400">{{ search.trim() ? t('chat.noSearchResults') : t('chat.noConversations') }}</p>
      <ul class="space-y-1">
        <li v-for="conversation in filtered" :key="conversation.id" class="chat-conversation-row group flex min-w-0 items-center gap-1 rounded-lg border px-1 py-1" :class="conversation.id === activeId ? 'chat-conversation-active' : 'border-transparent hover:bg-gray-50 dark:hover:bg-dark-800'">
          <form v-if="renamingId === conversation.id" class="flex min-w-0 flex-1 items-center gap-1" @submit.prevent="finishRename(conversation.id)">
            <label class="sr-only" :for="`${id}-rename`">{{ t('chat.conversationTitle') }}</label>
            <input :id="`${id}-rename`" ref="renameInput" v-model="renameTitle" class="input h-8 min-w-0 flex-1 !px-2 !py-1 text-sm" maxlength="160" @keydown.esc.prevent.stop="renamingId = null" />
            <button type="submit" class="pane-action" :disabled="!renameTitle.trim()" :aria-label="t('chat.save')" :title="t('chat.save')"><Icon name="check" size="sm" /></button>
            <button type="button" class="pane-action" :aria-label="t('chat.cancel')" :title="t('chat.cancel')" @click="renamingId = null"><Icon name="x" size="sm" /></button>
          </form>
          <template v-else>
            <button type="button" class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" :aria-current="conversation.id === activeId ? 'true' : undefined" @click="emit('select', conversation.id)">
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ title(conversation) }}</span>
              <span class="shrink-0 truncate text-[11px] text-gray-500 dark:text-gray-400">{{ runningIds.includes(conversation.id) ? t('chat.generating') : date(conversation.updatedAt) }}</span>
            </button>
            <div class="chat-conversation-actions flex shrink-0 gap-0">
              <button type="button" class="pane-action" :disabled="disabled" :aria-label="t('chat.renameNamed', { title: title(conversation) })" :title="t('chat.renameNamed', { title: title(conversation) })" @click="startRename(conversation)"><Icon name="edit" size="sm" /></button>
              <button type="button" class="pane-action text-red-600 dark:text-red-400" :disabled="disabled" :aria-label="t('chat.deleteNamed', { title: title(conversation) })" :title="t('chat.deleteNamed', { title: title(conversation) })" @click="emit('delete', conversation.id)"><Icon name="trash" size="sm" /></button>
            </div>
          </template>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { ChatConversation } from './types'

const props = defineProps<{ id: string; conversations: ChatConversation[]; activeId: string | null; runningIds: string[]; loading: boolean; disabled: boolean }>()
const emit = defineEmits<{ create: []; select: [id: string]; rename: [id: string, title: string]; delete: [id: string] }>()
const { t, locale } = useI18n()
const search = ref('')
const renamingId = ref<string | null>(null)
const renameTitle = ref('')
const renameInput = ref<HTMLInputElement[]>([])
const title = (conversation: ChatConversation) => conversation.title || t('chat.untitled')
const date = (value: number) => new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(value)
const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  return props.conversations.filter(conversation => conversation.title.toLocaleLowerCase().includes(query) || conversation.messages.some(message => message.content.toLocaleLowerCase().includes(query) || message.attachments.some(attachment => attachment.name.toLocaleLowerCase().includes(query))))
})
async function startRename(conversation: ChatConversation) {
  renamingId.value = conversation.id
  renameTitle.value = title(conversation)
  await nextTick()
  renameInput.value[0]?.focus()
  renameInput.value[0]?.select()
}
function finishRename(id: string) {
  if (!renameTitle.value.trim()) return
  emit('rename', id, renameTitle.value.trim())
  renamingId.value = null
}
watch(() => props.conversations, () => {
  if (renamingId.value && !props.conversations.some(item => item.id === renamingId.value)) renamingId.value = null
})
</script>

<style scoped>
.pane-action { @apply flex h-7 w-7 shrink-0 items-center justify-center rounded-md p-0 text-gray-500 hover:bg-gray-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-dark-700; }
.chat-conversation-row { min-height: 38px; }
.chat-conversation-actions { opacity: .55; transition: opacity .15s; }
.chat-conversation-row:hover .chat-conversation-actions, .chat-conversation-row:focus-within .chat-conversation-actions, .chat-conversation-active .chat-conversation-actions { opacity: 1; }
.chat-conversation-active { border-color: var(--app-accent); background: var(--app-surface-soft); }
</style>
