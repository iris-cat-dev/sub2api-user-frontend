import { describe, expect, it } from 'vitest'

import { sanitizeUrl } from '@/utils/url'

describe('sanitizeUrl', () => {
  it('accepts HTTPS and explicitly allowed relative image URLs', () => {
    expect(sanitizeUrl('https://cdn.example.com/logo.svg')).toBe('https://cdn.example.com/logo.svg')
    expect(sanitizeUrl('/branding/logo.svg', { allowRelative: true })).toBe('/branding/logo.svg')
  })

  it('accepts image data URLs only when explicitly enabled', () => {
    const image = 'data:image/svg+xml;base64,PHN2Zy8+'
    expect(sanitizeUrl(image)).toBe('')
    expect(sanitizeUrl(image, { allowDataUrl: true })).toBe(image)
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>', { allowDataUrl: true })).toBe('')
  })

  it('rejects script schemes and protocol-relative URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)', { allowRelative: true, allowDataUrl: true })).toBe('')
    expect(sanitizeUrl('//attacker.example/logo.svg', { allowRelative: true })).toBe('')
  })
})
