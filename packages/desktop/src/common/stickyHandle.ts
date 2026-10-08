// Electron hands back a native window handle as a little-endian pointer.
// Windows SetWindowPos needs that pointer as an integer.
export function hwndFromBuffer(buffer: Uint8Array): bigint | null {
  if (buffer.byteLength >= 8) {
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getBigUint64(0, true)
  }
  if (buffer.byteLength >= 4) {
    return BigInt(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength).getUint32(0, true))
  }
  return null
}
