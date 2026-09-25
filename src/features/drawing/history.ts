import type { DrawingTask } from './types'

// The playground uses this database and these key paths; opening a higher version
// would strand its own tabs on a versionchange event.
const DATABASE = 'gpt-image-playground'
const VERSION = 3
const SOURCE_STORES = ['tasks', 'images', 'thumbnails', 'agentConversations'] as const

interface StoredTask {
  id: string
  ownerUserId?: number
  mediaKind?: string
  sourceMode?: string
  prompt: string
  params?: { size?: string; quality?: string; [key: string]: unknown }
  apiModel?: string
  model?: string
  inputImageIds?: string[]
  outputImages?: string[]
  status?: DrawingTask['status']
  error?: string | null
  createdAt?: number
  finishedAt?: number | null
  elapsed?: number | null
  [key: string]: unknown
}

interface StoredImage {
  id: string
  dataUrl: string
  createdAt: number
  source: 'upload' | 'generated'
  mimeType?: string
}

function isGalleryImage(task: StoredTask): boolean {
  return (task.mediaKind === undefined || task.mediaKind === 'image')
    && (task.sourceMode === undefined || task.sourceMode === 'gallery')
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      for (const store of SOURCE_STORES) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open drawing history'))
    request.onblocked = () => reject(new Error('Close other drawing tabs to open image history'))
  })
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Unable to save drawing history'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Unable to save drawing history'))
  })
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to read drawing history'))
  })
}

function owner(userId: number): void {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Sign in to access drawing history')
}

async function imageId(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function readAllTasks(): Promise<StoredTask[]> {
  const db = await openDatabase()
  try {
    const tx = db.transaction('tasks', 'readonly')
    const done = completed(tx)
    const tasks = await result(tx.objectStore('tasks').getAll() as IDBRequest<StoredTask[]>)
    await done
    return tasks
  } finally {
    db.close()
  }
}

export async function loadDrawingTasks(userId: number): Promise<DrawingTask[]> {
  owner(userId)
  const db = await openDatabase()
  try {
    const tx = db.transaction(['tasks', 'images'], 'readonly')
    const done = completed(tx)
    const tasks = (await result(tx.objectStore('tasks').getAll() as IDBRequest<StoredTask[]>))
      .filter(task => task.ownerUserId === userId)
    const ids = new Set<string>()
    for (const task of tasks) {
      for (const id of task.inputImageIds ?? []) ids.add(id)
      for (const id of task.outputImages ?? []) ids.add(id)
    }
    const images = new Map<string, string>()
    const store = tx.objectStore('images')
    await Promise.all(Array.from(ids, async id => {
      const image = await result(store.get(id) as IDBRequest<StoredImage | undefined>)
      if (image?.dataUrl) images.set(id, image.dataUrl)
    }))
    await done
    return tasks.map((task): DrawingTask => ({
      id: task.id,
      prompt: task.prompt,
      model: task.apiModel ?? task.model ?? '',
      size: task.params?.size ?? 'auto',
      quality: task.params?.quality === 'low' || task.params?.quality === 'medium' || task.params?.quality === 'high'
        ? task.params.quality : 'auto',
      createdAt: task.createdAt ?? 0,
      status: task.status ?? 'error',
      error: task.error ?? null,
      inputImages: (task.inputImageIds ?? []).map(id => images.get(id)).filter((url): url is string => !!url),
      outputImages: (task.outputImages ?? []).map(id => images.get(id)).filter((url): url is string => !!url),
    })).sort((a, b) => b.createdAt - a.createdAt)
  } finally {
    db.close()
  }
}

export async function saveDrawingTask(userId: number, task: DrawingTask): Promise<void> {
  owner(userId)
  // Hash before opening a readwrite transaction: digest() suspends the event loop
  // and would make the transaction inactive before the writes are queued.
  const images = new Map<string, StoredImage>()
  const collect = (urls: string[], source: StoredImage['source']): Promise<string[]> => {
    return Promise.all(urls.map(async dataUrl => {
      if (!dataUrl.startsWith('data:image/')) throw new Error('Only persistent image data URLs can be saved in drawing history')
      const id = await imageId(dataUrl)
      images.set(id, {
        id, dataUrl, createdAt: Date.now(), source,
        mimeType: /^data:([^;,]+)/i.exec(dataUrl)?.[1],
      })
      return id
    }))
  }
  const [inputImageIds, outputImages] = await Promise.all([
    collect(task.inputImages, 'upload'), collect(task.outputImages, 'generated'),
  ])
  const db = await openDatabase()
  try {
    const tx = db.transaction(['tasks', 'images'], 'readwrite')
    const done = completed(tx)
    const store = tx.objectStore('tasks')
    const existing = await result(store.get(task.id) as IDBRequest<StoredTask | undefined>)
    if (existing && existing.ownerUserId !== userId) {
      tx.abort()
      await done.catch(() => undefined)
      throw new Error('Cannot overwrite another account’s drawing task')
    }
    for (const image of images.values()) {
      // Content-addressed IDs are shared with the source playground. Never
      // overwrite its metadata for an existing image.
      const imageStore = tx.objectStore('images')
      const saved = await result(imageStore.get(image.id) as IDBRequest<StoredImage | undefined>)
      if (!saved) imageStore.put(image)
    }
    const finishedAt = task.status === 'running' ? null : Date.now()
    const record: StoredTask = {
      ...existing,
      id: task.id,
      ownerUserId: userId,
      mediaKind: 'image',
      sourceMode: 'gallery',
      prompt: task.prompt,
      params: {
        output_format: 'png', output_compression: null, moderation: 'auto',
        n: 1, transparent_output: false,
        ...existing?.params, size: task.size, quality: task.quality,
      },
      apiModel: task.model,
      inputImageIds,
      outputImages,
      status: task.status,
      error: task.error,
      createdAt: task.createdAt,
      finishedAt,
      elapsed: finishedAt === null ? null : finishedAt - task.createdAt,
    }
    store.put(record)
    await done
  } finally {
    db.close()
  }
}

export async function removeDrawingTask(userId: number, id: string): Promise<void> {
  owner(userId)
  const db = await openDatabase()
  try {
    const tx = db.transaction('tasks', 'readwrite')
    const done = completed(tx)
    const store = tx.objectStore('tasks')
    const task = await result(store.get(id) as IDBRequest<StoredTask | undefined>)
    if (task && task.ownerUserId !== userId) {
      tx.abort()
      await done.catch(() => undefined)
      throw new Error('Cannot delete another account’s drawing task')
    }
    if (task) store.delete(id)
    // Images may be shared by hashes with other tasks and the source app;
    // retaining them avoids breaking references outside this feature.
    await done
  } finally {
    db.close()
  }
}

export async function countLegacyDrawingTasks(): Promise<number> {
  return (await readAllTasks()).filter(task => task.ownerUserId === undefined && isGalleryImage(task)).length
}

export async function adoptLegacyDrawingTasks(userId: number): Promise<number> {
  owner(userId)
  const db = await openDatabase()
  try {
    const tx = db.transaction('tasks', 'readwrite')
    const done = completed(tx)
    const store = tx.objectStore('tasks')
    let adopted = 0
    await new Promise<void>((resolve, reject) => {
      const cursor = store.openCursor()
      cursor.onerror = () => reject(cursor.error ?? new Error('Unable to adopt legacy drawings'))
      cursor.onsuccess = () => {
        const entry = cursor.result
        if (!entry) { resolve(); return }
        const task = entry.value as StoredTask
        if (task.ownerUserId === undefined && isGalleryImage(task)) {
          entry.update({ ...task, ownerUserId: userId })
          adopted++
        }
        entry.continue()
      }
    })
    await done
    return adopted
  } finally {
    db.close()
  }
}
