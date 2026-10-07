export const PLAIN_TEXT_EXTENSIONS = [
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'mdx',
  'text',
  'txt'
]

export function normalizeExtensions(value: string): string[] {
  const seen = new Set<string>()
  for (const part of value.split(/[,，\s]+/)) {
    const ext = part.trim().toLowerCase().replace(/^\.+/, '')
    if (!ext || ext.length > 20 || /[\\/:*?"<>|]/.test(ext)) continue
    seen.add(ext)
  }
  return [...seen]
}
