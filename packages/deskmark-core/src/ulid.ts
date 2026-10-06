const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function createUlid(time = Date.now(), random?: Uint8Array): string {
  const bytes = random ?? crypto.getRandomValues(new Uint8Array(10))
  let value = time
  let timePart = ''
  for (let index = 0; index < 10; index += 1) {
    timePart = ALPHABET[value % 32] + timePart
    value = Math.floor(value / 32)
  }
  let randomPart = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      randomPart += ALPHABET[(buffer >> bits) & 31]
    }
  }
  return timePart + randomPart
}

export function idQueue(ids: string[]): () => string {
  const pending = [...ids]
  return () => {
    const next = pending.shift()
    if (!next) throw new Error('测试用的 id 用完了')
    return next
  }
}
