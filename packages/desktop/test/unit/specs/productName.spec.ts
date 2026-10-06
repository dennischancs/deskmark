import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const displayNames: Record<string, string> = {
  en: 'Deskmark',
  'zh-CN': '桌笺',
  'zh-TW': '桌箋',
  ja: 'デスクメモ',
  ko: '책상메모',
  de: 'Tischzettel',
  fr: 'Pense-bête',
  es: 'Nota de mesa',
  pt: 'Nota de mesa',
  tr: 'Masa notu',
  nl: 'Bureaubriefje',
  ru: 'Листок'
}

describe('product display name', () => {
  it('follows the locale pack instead of a hardcoded MarkText title', () => {
    const localesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../static/locales')
    for (const [code, name] of Object.entries(displayNames)) {
      const file = resolve(localesDir, `${code}.json`)
      const data = JSON.parse(readFileSync(file, 'utf8')) as {
        app: { displayName: string }
        menu: { marktext: { title: string, about: string } }
      }
      expect(data.app.displayName, code).toBe(name)
      expect(data.menu.marktext.title, code).toBe(name)
      expect(data.menu.marktext.about, code).toContain(name)
      expect(JSON.stringify(data)).not.toContain('MarkText')
    }
  })
})
