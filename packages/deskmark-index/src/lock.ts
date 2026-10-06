import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export class IndexLock {
  private held = false
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  acquire(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    if (existsSync(this.file)) {
      const pid = Number(readFileSync(this.file, 'utf8'))
      if (Number.isInteger(pid) && pid > 0 && isAlive(pid)) {
        throw new Error('这个笔记文件夹的索引正在被另一个窗口使用')
      }
    }
    writeFileSync(this.file, String(process.pid))
    this.held = true
  }

  release(): void {
    if (!this.held) return
    rmSync(this.file, { force: true })
    this.held = false
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
