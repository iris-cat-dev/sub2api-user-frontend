export interface DrawingTask {
  id: string
  prompt: string
  model: string
  size: string
  quality: 'auto' | 'low' | 'medium' | 'high'
  createdAt: number
  status: 'running' | 'done' | 'error'
  error: string | null
  inputImages: string[]
  outputImages: string[]
}

export interface DrawingRequest {
  apiKey: string
  model: string
  prompt: string
  size: string
  quality: DrawingTask['quality']
  imageFiles: File[]
  stream: boolean
  signal?: AbortSignal
  onPreview?: (dataUrl: string) => void
}
