import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, persistTheme, resolveInitialTheme } from '../theme'

describe('theme', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.theme
    vi.restoreAllMocks()
  })

  it('restores a persisted light theme and applies it to the document', () => {
    localStorage.setItem('theme', 'light')

    const theme = resolveInitialTheme()
    applyTheme(theme)

    expect(theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('persists and applies dark theme', () => {
    persistTheme('dark')
    applyTheme('dark')

    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
