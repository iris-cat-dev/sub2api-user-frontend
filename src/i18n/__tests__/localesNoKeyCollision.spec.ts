import { describe, expect, it } from 'vitest'

import enCommon from '../locales/en/common'
import enDashboard from '../locales/en/dashboard'
import enLanding from '../locales/en/landing'
import enMisc from '../locales/en/misc'
import zhCommon from '../locales/zh/common'
import zhDashboard from '../locales/zh/dashboard'
import zhLanding from '../locales/zh/landing'
import zhMisc from '../locales/zh/misc'

type Modules = Record<string, Record<string, unknown>>

function collisions(modules: Modules): string[] {
  const seen = new Map<string, string>()
  const overlaps: string[] = []

  for (const [name, messages] of Object.entries(modules)) {
    for (const key of Object.keys(messages)) {
      const previous = seen.get(key)
      if (previous) {
        overlaps.push(`"${key}" in both ${previous} and ${name}`)
      } else {
        seen.set(key, name)
      }
    }
  }

  return overlaps
}

const locales: Record<string, Modules> = {
  zh: { landing: zhLanding, common: zhCommon, dashboard: zhDashboard, misc: zhMisc },
  en: { landing: enLanding, common: enCommon, dashboard: enDashboard, misc: enMisc },
}

describe.each(Object.keys(locales))('locale %s spread assembly', (locale) => {
  it('has no overlapping top-level keys', () => {
    expect(collisions(locales[locale])).toEqual([])
  })

  it('does not expose an admin namespace', () => {
    for (const messages of Object.values(locales[locale])) {
      expect(Object.keys(messages)).not.toContain('admin')
    }
  })
})
