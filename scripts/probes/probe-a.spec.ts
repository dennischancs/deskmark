// @vitest-environment happy-dom
// Probe A reports whether the untouched engine keeps Deskmark metadata.
// It must not fail when the bytes change. A throw means the probe itself broke.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Muya } from '../../packages/muya/src/muya'
import type Content from '../../packages/muya/src/block/base/content'

const here = dirname(fileURLToPath(import.meta.url))
const fixturePath = resolve(here, '../../fixtures/deskmark/roundtrip/with-metadata.md')
const reportPath = resolve(here, 'probe-a-report.json')

const booted: HTMLElement[] = []
let originalVersion: string | undefined
let hadVersion = false

beforeEach(() => {
  hadVersion = 'MUYA_VERSION' in window
  originalVersion = window.MUYA_VERSION
  window.MUYA_VERSION = 'probe-a'
})

afterEach(() => {
  while (booted.length)
    booted.pop()!.remove()
  document.getSelection()?.removeAllRanges()
  if (hadVersion)
    window.MUYA_VERSION = originalVersion as string
  else
    delete (window as Partial<Window>).MUYA_VERSION
})

interface StepReport {
  step: string
  frontMatter: 'kept' | 'lost'
  inlineComment: 'kept' | 'lost'
  customKey: 'kept' | 'lost'
  sawEdit: boolean
  firstBox: 'open' | 'done' | 'missing'
  markdown: string
}

function boot(markdown: string): Muya {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const muya = new Muya(host, {} as ConstructorParameters<typeof Muya>[1])
  muya.init()
  muya.setContent(markdown)
  booted.push(muya.domNode)
  return muya
}

function judge(step: string, markdown: string): StepReport {
  const firstTask = markdown.match(/^- \[([ x])\] /m)
  return {
    step,
    frontMatter: markdown.includes('kind: todo') ? 'kept' : 'lost',
    inlineComment: markdown.includes('<!-- deskmark:') ? 'kept' : 'lost',
    customKey: markdown.includes('custom: keep-me') ? 'kept' : 'lost',
    sawEdit: markdown.includes('买牛奶 改'),
    firstBox: firstTask?.[1] === 'x' ? 'done' : firstTask?.[1] === ' ' ? 'open' : 'missing',
    markdown
  }
}

function taskItems(muya: Muya): Array<{ attachments: { forEach: (cb: (item: { update?: (checked: boolean, source: string) => void, constructor: { blockName?: string } }) => void) => void } }> {
  const items: Array<{ attachments: { forEach: (cb: (item: { update?: (checked: boolean, source: string) => void, constructor: { blockName?: string } }) => void) => void } }> = []
  const visit = (block: { constructor: { blockName?: string }, children?: { forEach: (cb: (child: unknown) => void) => void }, attachments?: { forEach: (cb: (item: { update?: (checked: boolean, source: string) => void, constructor: { blockName?: string } }) => void) => void } }) => {
    if (block.constructor.blockName === 'task-list-item' && block.attachments)
      items.push({ attachments: block.attachments })
    block.children?.forEach(child => visit(child as typeof block))
  }
  visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0])
  return items
}

function checkFirstTask(muya: Muya): void {
  const item = taskItems(muya)[0]
  expect(item, 'first task item').toBeTruthy()
  let checkbox: { update?: (checked: boolean, source: string) => void } | null = null
  item.attachments.forEach((attachment) => {
    if (attachment.constructor.blockName === 'task-list-checkbox')
      checkbox = attachment
  })
  expect(checkbox, 'task checkbox').toBeTruthy()
  checkbox!.update!(true, 'user')
}

function contentBlocks(muya: Muya): Content[] {
  const out: Content[] = []
  let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant()
  while (block) {
    out.push(block)
    block = block.nextContentInContext() ?? null
  }
  return out
}

describe('probe A metadata roundtrip', () => {
  it('records keep or loss and does not change the engine', () => {
    const original = readFileSync(fixturePath, 'utf8').replace(/\r\n/g, '\n')
    const muya = boot(original)
    const steps: StepReport[] = []

    steps.push(judge('load', muya.getMarkdown()))

    checkFirstTask(muya)
    muya.editor.jsonState.flush()
    steps.push(judge('check', muya.getMarkdown()))
    expect(steps.at(-1)?.firstBox).toBe('done')

    const blocks = contentBlocks(muya)
    expect(blocks.length).toBeGreaterThan(0)
    const target = blocks.find(block => block.text.includes('买牛奶')) ?? blocks[0]
    expect(target.text).toContain('买牛奶')
    const commentAt = target.text.indexOf('<!--')
    target.text = commentAt === -1
      ? `${target.text} 改`
      : `${target.text.slice(0, commentAt).trimEnd()} 改 ${target.text.slice(commentAt)}`
    muya.editor.jsonState.flush()
    steps.push(judge('edit-line', muya.getMarkdown()))
    expect(steps.at(-1)?.sawEdit).toBe(true)

    const source = muya.getMarkdown()
    muya.setContent(source)
    steps.push(judge('source-mode', muya.getMarkdown()))

    muya.undo()
    steps.push(judge('undo', muya.getMarkdown()))

    const report = {
      engine: '@muyajs/core',
      changedEngine: false,
      steps
    }
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    expect(steps.map(step => step.step)).toEqual(['load', 'check', 'edit-line', 'source-mode', 'undo'])
  })
})
