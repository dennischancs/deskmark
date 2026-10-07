export function samePluginEntry(entry: string, src: string): boolean {
  if (!entry || !src) return false
  try {
    const got = new URL(src)
    const want = new URL(entry)
    if (got.protocol !== want.protocol || got.host !== want.host) return false
    return decodeURIComponent(got.pathname) === decodeURIComponent(want.pathname)
  } catch {
    return false
  }
}
