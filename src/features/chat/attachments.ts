import type { ChatAttachment, ChatAttachmentKind } from './types'

export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 5
export const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const MAX_CHAT_TEXT_ATTACHMENT_BYTES = 256 * 1024
export const MAX_CHAT_ATTACHMENT_CONTEXT_BYTES = 20 * 1024 * 1024

const imageTypes: Record<string, true> = {
  'image/png': true,
  'image/jpeg': true,
  'image/webp': true,
}
const textMimeTypes: Record<string, true> = {
  'application/json': true,
  'application/ld+json': true,
  'application/sql': true,
  'application/toml': true,
  'application/x-httpd-php': true,
  'application/x-javascript': true,
  'application/x-ndjson': true,
  'application/x-sh': true,
  'application/x-yaml': true,
  'application/xml': true,
  'application/yaml': true,
}
const textExtensions: Record<string, true> = {
  astro: true, bash: true, c: true, cc: true, conf: true, cpp: true, cs: true, css: true,
  csv: true, dart: true, fish: true, go: true, gql: true, graphql: true, gradle: true, h: true,
  hpp: true, htm: true, html: true, ini: true, java: true, js: true, json: true, jsonl: true,
  jsx: true, kt: true, kts: true, less: true, log: true, lua: true, md: true, markdown: true,
  mjs: true, php: true, properties: true, py: true, r: true, rb: true, rs: true, scss: true,
  sh: true, sql: true, svelte: true, swift: true, tex: true, toml: true, ts: true, tsv: true,
  tsx: true, txt: true, vue: true, xml: true, yaml: true, yml: true, zsh: true,
}
const inferredImageTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export const CHAT_ATTACHMENT_ACCEPT = [
  ...Object.keys(imageTypes),
  'application/pdf',
  'text/*',
  ...Object.keys(textExtensions).map(extension => `.${extension}`),
].join(',')

export interface ChatAttachmentSpec {
  kind: ChatAttachmentKind
  mimeType: string
}

function extension(name: string): string {
  const index = name.lastIndexOf('.')
  return index < 0 ? '' : name.slice(index + 1).toLocaleLowerCase()
}

export function chatAttachmentSpec(file: { name: string; type: string }): ChatAttachmentSpec | null {
  const suffix = extension(file.name)
  const declaredType = file.type.toLocaleLowerCase()
  const imageType = imageTypes[declaredType] ? declaredType : inferredImageTypes[suffix]
  if (imageType) return { kind: 'image', mimeType: imageType }
  if (declaredType === 'application/pdf' || suffix === 'pdf') return { kind: 'pdf', mimeType: 'application/pdf' }
  if (declaredType.startsWith('text/') || textMimeTypes[declaredType] || textExtensions[suffix]) {
    return { kind: 'text', mimeType: declaredType || 'text/plain' }
  }
  return null
}

export function maxChatAttachmentBytes(kind: ChatAttachmentKind): number {
  return kind === 'text' ? MAX_CHAT_TEXT_ATTACHMENT_BYTES : MAX_CHAT_ATTACHMENT_BYTES
}

function fileDataUrl(file: File, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read attachment'))
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : ''
      const comma = value.indexOf(',')
      if (comma < 0) {
        reject(new Error('Unable to encode attachment'))
        return
      }
      resolve(value.startsWith(`data:${mimeType};`) ? value : `data:${mimeType};base64,${value.slice(comma + 1)}`)
    }
    reader.readAsDataURL(file)
  })
}

export async function readChatAttachment(file: File, spec: ChatAttachmentSpec): Promise<ChatAttachment> {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: spec.mimeType,
    size: file.size,
    kind: spec.kind,
    data: spec.kind === 'text' ? await file.text() : await fileDataUrl(file, spec.mimeType),
  }
}

export function isValidChatAttachmentData(attachment: ChatAttachment): boolean {
  const spec = chatAttachmentSpec({ name: attachment.name, type: attachment.mimeType })
  if (!spec || spec.kind !== attachment.kind || spec.mimeType !== attachment.mimeType) return false
  if (!Number.isSafeInteger(attachment.size) || attachment.size <= 0 || attachment.size > maxChatAttachmentBytes(attachment.kind)) return false
  if (!attachment.data || attachment.name.length > 255 || attachment.mimeType.length > 100) return false
  if (attachment.kind === 'text') return attachment.data.length <= MAX_CHAT_TEXT_ATTACHMENT_BYTES
  return attachment.data.startsWith(`data:${attachment.mimeType};base64,`)
    && attachment.data.length <= Math.ceil(MAX_CHAT_ATTACHMENT_BYTES * 4 / 3) + 128
}

export function chatAttachmentBase64(attachment: ChatAttachment): string {
  const comma = attachment.data.indexOf(',')
  return comma < 0 ? '' : attachment.data.slice(comma + 1)
}
