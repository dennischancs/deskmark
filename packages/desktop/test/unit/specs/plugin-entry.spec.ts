import { describe, expect, it } from 'vitest'
import { samePluginEntry } from '../../../src/main/deskmark/pluginEntry'

describe('plugin entry url', () => {
  const entry = 'file:///D:/repo/plugins/sample-wordcount/index.html'

  it('allows the same file with a language query', () => {
    expect(samePluginEntry(entry, `${entry}?lang=zh-CN&fg=%23111111`)).toBe(true)
  })

  it('rejects a different file or site', () => {
    expect(samePluginEntry(entry, 'file:///D:/repo/plugins/sample-wordcount/other.html')).toBe(false)
    expect(samePluginEntry(entry, 'https://example.com/index.html')).toBe(false)
    expect(samePluginEntry('', entry)).toBe(false)
  })
})
