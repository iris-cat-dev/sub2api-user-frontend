<template>
  <div v-if="!embedded" class="border-b border-gray-200 bg-white/90 dark:border-dark-700 dark:bg-dark-900/90">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <a href="/dashboard" class="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-white" :aria-label="t('drawing.back')">
        <img :src="logoPath" alt="" class="h-9 w-9 rounded-lg object-contain" />
        <span>{{ t('drawing.title') }}</span>
      </a>
      <a href="/dashboard" class="btn btn-secondary btn-sm">{{ t('drawing.back') }}</a>
    </div>
  </div>
  <main :class="embedded ? 'space-y-6 text-gray-900 dark:text-white' : 'mx-auto max-w-7xl space-y-6 px-4 py-6 text-gray-900 dark:text-white sm:px-6 lg:px-8'">
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">{{ t('drawing.title') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('drawing.subtitle') }}</p>
      </div>
      <button type="button" class="btn btn-secondary" :disabled="loadingKeys" @click="loadKeys">
        {{ loadingKeys ? t('drawing.loadingKeys') : t('drawing.refreshKeys') }}
      </button>
    </header>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
      <section class="card p-5 sm:p-6" :aria-label="t('drawing.title')">
        <form class="space-y-5" @submit.prevent="generate">
          <div>
            <label for="drawing-key" class="input-label">{{ t('drawing.key') }}</label>
            <select id="drawing-key" v-model="selectedKeyId" class="input" :disabled="loadingKeys || generating" @change="loadModels">
              <option value="">{{ t('drawing.selectKey') }}</option>
              <option v-for="key in availableKeys" :key="key.id" :value="String(key.id)">{{ key.name }} · {{ key.group?.name || t('drawing.unboundGroup') }}</option>
            </select>
            <p v-if="!loadingKeys && !availableKeys.length" class="input-hint">{{ t('drawing.noKey') }} <a class="text-primary-600 underline dark:text-primary-400" href="/keys">{{ t('drawing.manageKeys') }}</a></p>
            <p v-if="selectedKey && keyReason" role="alert" class="input-error-text">{{ keyReason }} <a class="underline" href="/keys">{{ t('drawing.manageKeys') }}</a></p>
            <p v-if="keysError" role="alert" class="input-error-text">{{ keysError }}</p>
          </div>

          <div>
            <label for="drawing-model" class="input-label">{{ t('drawing.model') }}</label>
            <select id="drawing-model" v-model="model" class="input" :disabled="!usableKey || loadingModels || generating">
              <option value="">{{ loadingModels ? t('drawing.loadingModels') : t('drawing.selectModel') }}</option>
              <option v-for="name in models" :key="name" :value="name">{{ name }}</option>
            </select>
            <p v-if="modelsError" role="alert" class="input-error-text">{{ modelsError }} <button type="button" class="underline" @click="loadModels">{{ t('drawing.retry') }}</button></p>
          </div>

          <div v-if="!isGrokModel" class="grid grid-cols-2 gap-3">
            <div>
              <label for="drawing-size" class="input-label">{{ t('drawing.size') }}</label>
              <select id="drawing-size" v-model="size" class="input" :disabled="generating">
                <option value="auto">{{ t('drawing.auto') }}</option>
                <option value="1024x1024">1024 × 1024</option>
                <option value="1536x1024">1536 × 1024</option>
                <option value="1024x1536">1024 × 1536</option>
              </select>
            </div>
            <div>
              <label for="drawing-quality" class="input-label">{{ t('drawing.quality') }}</label>
              <select id="drawing-quality" v-model="quality" class="input" :disabled="generating">
                <option value="auto">{{ t('drawing.auto') }}</option>
                <option value="low">{{ t('drawing.low') }}</option>
                <option value="medium">{{ t('drawing.medium') }}</option>
                <option value="high">{{ t('drawing.high') }}</option>
              </select>
            </div>
          </div>

          <div>
            <label for="drawing-prompt" class="input-label">{{ t('drawing.prompt') }}</label>
            <textarea id="drawing-prompt" v-model="prompt" class="input min-h-32 resize-y" :disabled="generating" :placeholder="t('drawing.promptPlaceholder')" required />
          </div>

          <div class="rounded-xl border border-dashed border-gray-300 p-4 dark:border-dark-600" :class="dragging ? 'bg-primary-50 dark:bg-primary-500/10' : ''" @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true" @dragleave.prevent="onDragLeave" @drop.prevent="onDrop">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-medium">{{ t('drawing.references') }} <span class="font-normal text-gray-500 dark:text-gray-400">({{ attachments.length }}/{{ maxReferences }})</span></p>
                <p class="input-hint">{{ t('drawing.referenceHint') }}</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="generating || attachments.length >= maxReferences" @click="fileInput?.click()">{{ t('drawing.addImages') }}</button>
              <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" multiple class="hidden" :aria-label="t('drawing.addImages')" @change="onFileInput" />
            </div>
            <div v-if="attachments.length" class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              <div v-for="attachment in attachments" :key="attachment.url" class="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-dark-700">
                <img :src="attachment.url" :alt="attachment.file.name" class="h-full w-full object-cover" />
                <button type="button" class="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white hover:bg-black" :aria-label="t('drawing.removeImage', { name: attachment.file.name })" :disabled="generating" @click="removeAttachment(attachment)">×</button>
              </div>
            </div>
            <p v-if="attachments.length > maxReferences" role="alert" class="input-error-text">{{ t('drawing.tooManyReferences', { count: maxReferences }) }}</p>
          </div>

          <div v-if="!isGrokModel" class="space-y-1">
            <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input v-model="streamingPreview" type="checkbox" class="rounded border-gray-300 text-primary-600" :disabled="generating" />
              {{ t('drawing.streaming') }}
            </label>
            <p v-if="attachments.length" class="input-hint">{{ t('drawing.editStreamingHint') }}</p>
          </div>
          <p v-if="formError" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{{ formError }}</p>
          <div class="flex gap-2">
            <button v-if="generating" type="button" class="btn btn-secondary flex-1" @click="cancelGeneration">{{ t('drawing.cancel') }}</button>
            <button v-else type="submit" class="btn btn-primary flex-1" :disabled="!usableKey || !model || !prompt.trim() || loadingKeys || loadingModels || attachments.length > maxReferences">{{ attachments.length ? t('drawing.edit') : t('drawing.generate') }}</button>
          </div>
        </form>
      </section>

      <section class="min-w-0 space-y-4" :aria-label="t('drawing.gallery')">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">{{ t('drawing.gallery') }}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('drawing.historyHint') }}</p>
          </div>
          <button v-if="legacyCount > 0" type="button" class="btn btn-secondary btn-sm" :disabled="adopting" @click="adoptLegacy">
            {{ adopting ? t('drawing.importing') : t('drawing.importLegacy', { count: legacyCount }) }}
          </button>
        </div>
        <p v-if="historyError" role="alert" class="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{{ historyError }}</p>
        <p v-if="loadingHistory" class="py-8 text-center text-sm text-gray-500">{{ t('drawing.loadingHistory') }}</p>
        <p v-else-if="!tasks.length" class="card px-6 py-14 text-center text-sm text-gray-500 dark:text-gray-400">{{ t('drawing.empty') }}</p>
        <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article v-for="task in tasks" :key="task.id" class="card min-w-0 overflow-hidden">
            <div v-if="task.outputImages.length" class="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-dark-900" :class="task.outputImages.length === 1 ? 'grid-cols-1' : ''">
              <div v-for="(image, index) in task.outputImages" :key="index" class="group relative aspect-square overflow-hidden">
                <img :src="image" :alt="t('drawing.resultAlt', { index: index + 1, prompt: task.prompt })" class="h-full w-full object-cover" loading="lazy" />
                <div class="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/70 p-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button type="button" class="rounded bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 hover:bg-white disabled:opacity-50" :disabled="generating" @click="useAsReference(image)">{{ t('drawing.useReference') }}</button>
                  <button type="button" class="rounded bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 hover:bg-white" @click="download(image, task.id, index)">{{ t('drawing.download') }}</button>
                </div>
              </div>
            </div>
            <div v-else-if="task.status === 'running' && task.id === previewTaskId" class="flex aspect-square flex-col items-center justify-center gap-3 bg-gray-100 px-4 text-center dark:bg-dark-900">
              <img v-if="previewTaskId === task.id && preview" :src="preview" :alt="t('drawing.preview')" class="max-h-64 max-w-full object-contain" />
              <span class="text-sm text-gray-600 dark:text-gray-300">{{ t('drawing.generating') }}</span>
            </div>
            <div v-else class="flex aspect-square items-center justify-center bg-red-50 px-5 text-center text-sm text-red-700 dark:bg-red-900/10 dark:text-red-300">{{ task.error || t('drawing.interrupted') }}</div>
            <div class="space-y-2 p-4">
              <p class="line-clamp-3 whitespace-pre-wrap break-words text-sm font-medium" :title="task.prompt">{{ task.prompt }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ task.model }} · {{ formatDate(task.createdAt) }}</p>
              <div v-if="task.inputImages.length" class="flex gap-1 overflow-x-auto" :aria-label="t('drawing.references')">
                <img v-for="(image, index) in task.inputImages" :key="index" :src="image" :alt="t('drawing.referenceAlt', { index: index + 1 })" class="h-10 w-10 shrink-0 rounded object-cover" loading="lazy" />
              </div>
              <div class="flex justify-end">
                <button v-if="task.id !== previewTaskId" type="button" class="text-xs text-red-600 hover:underline dark:text-red-400" @click="deleteTask(task)">{{ t('drawing.delete') }}</button>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { keysAPI } from '@/api/keys'
import type { ApiKey } from '@/types'
import { requestDrawing, listDrawingModels } from './imageClient'
import { adoptLegacyDrawingTasks, countLegacyDrawingTasks, loadDrawingTasks, removeDrawingTask, saveDrawingTask } from './history'
import type { DrawingTask } from './types'

const props = defineProps<{ userId: number; embedded?: boolean }>()
const { t } = useI18n()
const logoPath = '/logo.svg'
type Attachment = { file: File; url: string }
const attachments = ref<Attachment[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const prompt = ref('')
const model = ref('')
const models = ref<string[]>([])
const size = ref('auto')
const quality = ref<DrawingTask['quality']>('auto')
const generationStream = ref(true)
const editStream = ref(false)
const availableKeys = ref<ApiKey[]>([])
const selectedKeyId = ref('')
const selectedKey = computed(() => availableKeys.value.find(key => String(key.id) === selectedKeyId.value))
const keyReason = computed(() => {
  const key = selectedKey.value
  if (!key) return ''
  if (key.status !== 'active') return t('drawing.inactiveKey')
  if (key.group_id == null || !key.group) return t('drawing.unboundKey')
  if (key.group.status !== 'active') return t('drawing.inactiveGroup', { group: key.group.name })
  if (!key.group.allow_image_generation) return t('drawing.disallowedGroup', { group: key.group.name })
  if (!['openai', 'grok', 'composite'].includes(key.group.platform)) return t('drawing.unsupportedGroup', { group: key.group.name })
  return ''
})
const usableKey = computed(() => selectedKey.value && !keyReason.value ? selectedKey.value : null)
const isGrokModel = computed(() => /^grok-imagine(?:$|-image)/i.test(model.value))
const maxReferences = computed(() => isGrokModel.value ? 3 : 16)
const streamingPreview = computed({
  get: () => attachments.value.length ? editStream.value : generationStream.value,
  set: value => {
    if (attachments.value.length) editStream.value = value
    else generationStream.value = value
  },
})
const loadingKeys = ref(false)
const loadingModels = ref(false)
const loadingHistory = ref(false)
const generating = ref(false)
const adopting = ref(false)
const keysError = ref('')
const modelsError = ref('')
const historyError = ref('')
const formError = ref('')
const tasks = ref<DrawingTask[]>([])
const legacyCount = ref(0)
const preview = ref('')
const previewTaskId = ref<string | null>(null)
let controller: AbortController | null = null
let revision = 0
let modelsRevision = 0
let disposed = false
const localTaskIds = new Set<string>()

function message(error: unknown): string {
  return error instanceof Error ? error.message : t('drawing.unexpected')
}

async function loadKeys() {
  const current = revision
  loadingKeys.value = true
  keysError.value = ''
  try {
    const found: ApiKey[] = []
    let page = 1
    while (true) {
      const response = await keysAPI.list(page, 100)
      if (current !== revision || disposed) return
      found.push(...response.items)
      if (page >= response.pages || response.items.length === 0) break
      page++
    }
    availableKeys.value = found
    if (!found.some(key => String(key.id) === selectedKeyId.value)) {
      const preferred = found.find(key => key.status === 'active' && key.group?.status === 'active'
        && key.group.allow_image_generation && ['openai', 'grok', 'composite'].includes(key.group.platform))
      selectedKeyId.value = String((preferred ?? found[0])?.id ?? '')
    }
    await loadModels()
  } catch (error) {
    if (current === revision && !disposed) keysError.value = t('drawing.loadKeysFailed', { message: message(error) })
  } finally {
    if (current === revision && !disposed) loadingKeys.value = false
  }
}

async function loadModels() {
  const current = ++modelsRevision
  const key = usableKey.value
  models.value = []
  model.value = ''
  modelsError.value = ''
  if (!key) { loadingModels.value = false; return }
  loadingModels.value = true
  try {
    const names = await listDrawingModels(key.key, key.group?.platform)
    if (current !== modelsRevision || disposed) return
    models.value = [...new Set(names.filter(name => typeof name === 'string' && name.trim()))]
    model.value = models.value[0] || ''
    if (!models.value.length) modelsError.value = t('drawing.noModels')
  } catch (error) {
    if (current === modelsRevision && !disposed) modelsError.value = t('drawing.loadModelsFailed', { message: message(error) })
  } finally {
    if (current === modelsRevision && !disposed) loadingModels.value = false
  }
}

async function loadHistory(userId: number, current: number) {
  loadingHistory.value = true
  historyError.value = ''
  try {
    const [owned, count] = await Promise.all([loadDrawingTasks(userId), countLegacyDrawingTasks()])
    if (current !== revision || disposed) return
    tasks.value = [...tasks.value.filter(task => localTaskIds.has(task.id)), ...owned.filter(task => !localTaskIds.has(task.id))]
      .sort((a, b) => b.createdAt - a.createdAt)
    legacyCount.value = count
  } catch (error) {
    if (current === revision && !disposed) historyError.value = t('drawing.loadHistoryFailed', { message: message(error) })
  } finally {
    if (current === revision && !disposed) loadingHistory.value = false
  }
}

watch(() => props.userId, userId => {
  ++revision
  ++modelsRevision
  controller?.abort()
  controller = null
  generating.value = false
  preview.value = ''
  previewTaskId.value = null
  localTaskIds.clear()
  clearAttachments()
  prompt.value = ''
  formError.value = ''
  dragging.value = false
  adopting.value = false
  loadingModels.value = false
  tasks.value = []
  legacyCount.value = 0
  availableKeys.value = []
  selectedKeyId.value = ''
  models.value = []
  model.value = ''
  void loadHistory(userId, revision)
  void loadKeys()
}, { immediate: true })

function addFiles(files: File[]) {
  if (generating.value) { formError.value = t('drawing.busyReferences'); return }
  const images = files.filter(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
  if (images.length !== files.length) formError.value = t('drawing.imageOnly')
  if (attachments.value.length + images.length > maxReferences.value) formError.value = t('drawing.tooManyReferences', { count: maxReferences.value })
  for (const file of images.slice(0, maxReferences.value - attachments.value.length)) {
    attachments.value.push({ file, url: URL.createObjectURL(file) })
  }
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(Array.from(input.files || []))
  input.value = ''
}
function onDragLeave(event: DragEvent) {
  if (!event.currentTarget || !(event.currentTarget as Element).contains(event.relatedTarget as Node | null)) dragging.value = false
}
function onDrop(event: DragEvent) {
  dragging.value = false
  addFiles(Array.from(event.dataTransfer?.files || []))
}
function onPaste(event: ClipboardEvent) {
  const files = Array.from(event.clipboardData?.items || [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null)
  if (files.length) {
    event.preventDefault()
    addFiles(files)
  }
}
function removeAttachment(attachment: Attachment) {
  attachments.value = attachments.value.filter(item => item !== attachment)
  URL.revokeObjectURL(attachment.url)
}
function clearAttachments() {
  for (const attachment of attachments.value) URL.revokeObjectURL(attachment.url)
  attachments.value = []
}
function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error || new Error(t('drawing.readReferenceFailed')))
    reader.readAsDataURL(file)
  })
}
function cancelGeneration() {
  controller?.abort()
}

async function generate() {
  const key = usableKey.value
  const text = prompt.value.trim()
  if (generating.value || !key || !model.value || !text || attachments.value.length > maxReferences.value) return
  formError.value = ''
  generating.value = true
  const current = revision
  const userId = props.userId
  const abort = new AbortController()
  controller = abort
  const files = attachments.value.map(item => item.file)
  const task: DrawingTask = {
    id: crypto.randomUUID(), prompt: text, model: model.value, size: size.value,
    quality: quality.value, createdAt: Date.now(), status: 'running', error: null,
    inputImages: [], outputImages: []
  }
  localTaskIds.add(task.id)
  tasks.value = [task, ...tasks.value]
  previewTaskId.value = task.id
  preview.value = ''
  const inputImages = Promise.all(files.map(fileDataUrl)).then(
    images => ({ images, error: null as unknown }),
    error => ({ images: [] as string[], error: error as unknown })
  )
  try {
    const outputImages = await requestDrawing({
      apiKey: key.key, model: task.model, prompt: task.prompt, size: task.size, quality: task.quality,
      imageFiles: files, stream: !isGrokModel.value && streamingPreview.value, signal: abort.signal,
      onPreview: image => { if (current === revision && !disposed && !abort.signal.aborted) preview.value = image }
    })
    if (current !== revision || disposed) return
    if (abort.signal.aborted) throw new Error(t('drawing.cancelled'))
    if (!outputImages.length) throw new Error(t('drawing.noImages'))
    task.outputImages = outputImages
    task.status = 'done'
    const references = await inputImages
    if (references.error) formError.value = t('drawing.referenceSaveFailed', { message: message(references.error) })
    task.inputImages = references.images
    if (current !== revision || disposed) return
    await saveDrawingTask(userId, task)
    if (current !== revision || disposed) return
    clearAttachments()
  } catch (error) {
    if (current !== revision || disposed) return
    if (task.status !== 'done') {
      task.status = 'error'
      task.error = abort.signal.aborted ? t('drawing.cancelled') : message(error)
      task.inputImages = (await inputImages).images
      try { await saveDrawingTask(userId, task) } catch (saveError) { historyError.value = t('drawing.historySaveFailed', { message: message(saveError) }) }
    } else {
      historyError.value = t('drawing.resultNotSaved', { message: message(error) })
    }
  } finally {
    if (current === revision && !disposed) {
      tasks.value = [...tasks.value]
      generating.value = false
      controller = null
      preview.value = ''
      previewTaskId.value = null
    }
  }
}

function dataUrlBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',')
  const mime = /^data:(image\/[-+\w.]+);base64$/i.exec(dataUrl.slice(0, comma))?.[1]
  if (!mime) throw new Error(t('drawing.referenceNotImage'))
  const bytes = Uint8Array.from(atob(dataUrl.slice(comma + 1)), char => char.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}
async function remoteImageBlob(url: string): Promise<Blob> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Image download returned ${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error(t('drawing.referenceNotImage'))
  return blob
}

async function useAsReference(image: string) {
  formError.value = ''
  try {
    const blob = image.startsWith('data:') ? dataUrlBlob(image) : await remoteImageBlob(image)
    addFiles([new File([blob], `reference-${Date.now()}.${extension(blob.type)}`, { type: blob.type })])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (error) {
    formError.value = t('drawing.addReferenceFailed', { message: message(error) })
  }
}
function extension(type: string) {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png'
}
async function download(image: string, taskId: string, index: number) {
  historyError.value = ''
  try {
    const dataMime = /^data:(image\/[-+\w.]+);base64,/i.exec(image)?.[1]
    const blob = dataMime ? null : await remoteImageBlob(image)
    const url = blob ? URL.createObjectURL(blob) : image
    const link = document.createElement('a')
    link.href = url
    link.download = `drawing-${taskId}-${index + 1}.${extension(dataMime ?? blob?.type ?? '')}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    if (blob) window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (error) {
    historyError.value = t('drawing.downloadFailed', { message: message(error) })
  }
}
async function deleteTask(task: DrawingTask) {
  if (!window.confirm(t('drawing.confirmDelete'))) return
  const current = revision
  try {
    await removeDrawingTask(props.userId, task.id)
    if (current === revision && !disposed) {
      localTaskIds.delete(task.id)
      tasks.value = tasks.value.filter(item => item.id !== task.id)
    }
  } catch (error) {
    if (current === revision && !disposed) historyError.value = t('drawing.deleteFailed', { message: message(error) })
  }
}
async function adoptLegacy() {
  if (!window.confirm(t('drawing.confirmImport', { count: legacyCount.value }))) return
  adopting.value = true
  historyError.value = ''
  const current = revision
  const userId = props.userId
  try {
    await adoptLegacyDrawingTasks(userId)
    if (current === revision && !disposed) await loadHistory(userId, current)
  } catch (error) {
    if (current === revision && !disposed) historyError.value = t('drawing.importFailed', { message: message(error) })
  } finally {
    if (current === revision && !disposed) adopting.value = false
  }
}
function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}
onMounted(() => document.addEventListener('paste', onPaste))
onBeforeUnmount(() => {
  disposed = true
  ++revision
  controller?.abort()
  document.removeEventListener('paste', onPaste)
  clearAttachments()
})
</script>
