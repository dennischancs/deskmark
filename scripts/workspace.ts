import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export type WorkspaceCommand = 'clean' | 'build' | 'rebuild'
export type ReleaseTarget = 'win' | 'mac' | 'linux'

// Generated output only. node_modules stays, so a clean does not force a reinstall.
export const CLEAN_RELATIVE_PATHS = [
  'dist',
  'packages/desktop/out',
  '.eslintcache',
  'packages/desktop/.eslintcache',
  'test-results',
  'playwright-report',
  'packages/desktop/test-results',
  'packages/desktop/playwright-report',
  'packages/muya/lib',
  'packages/muya/coverage',
  'packages/muya/e2e/test-results',
  'packages/muya/e2e/playwright-report',
  'packages/website/.next',
  'packages/website/out',
  'packages/website/.open-next'
]

export function resolveInside(root: string, relative: string): string {
  const base = path.resolve(root)
  const target = path.resolve(base, relative)
  const fromRoot = path.relative(base, target)
  if (fromRoot === '' || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) {
    throw new Error(`Refusing to touch a path outside the repository: ${relative}`)
  }
  return target
}

export function releaseTarget(platform: NodeJS.Platform): ReleaseTarget | null {
  if (platform === 'win32') return 'win'
  if (platform === 'darwin') return 'mac'
  if (platform === 'linux') return 'linux'
  return null
}

// Names stay aligned with packages/desktop/package.json. Windows x64 is the
// published installer; an arm64 Windows machine uses the arm64 script instead.
export function releaseScriptName(target: ReleaseTarget, arch: string, unpack: boolean): string {
  if (unpack) return 'build:unpack'
  if (target === 'win') return arch === 'arm64' ? 'build:win:arm64' : 'build:win'
  if (target === 'mac') return 'build:mac'
  return 'build:linux'
}

export function parseArgs(argv: string[]): { command: WorkspaceCommand, unpack: boolean } {
  const [command, ...rest] = argv
  if (command !== 'clean' && command !== 'build' && command !== 'rebuild') {
    throw new Error('Usage: tsx scripts/workspace.ts <clean|build|rebuild> [--unpack]')
  }
  const unknown = rest.filter(item => item !== '--unpack')
  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown.join(' ')}`)
  if (command === 'clean' && rest.includes('--unpack')) {
    throw new Error('--unpack only applies to build or rebuild')
  }
  return { command, unpack: rest.includes('--unpack') }
}

export function cleanWorkspace(root: string): string[] {
  const removed: string[] = []
  for (const relative of CLEAN_RELATIVE_PATHS) {
    const target = resolveInside(root, relative)
    if (!existsSync(target)) continue
    rmSync(target, { recursive: true, force: true })
    removed.push(relative)
  }
  const locales = resolveInside(root, 'packages/desktop/static/locales')
  if (existsSync(locales)) {
    for (const name of readdirSync(locales)) {
      if (!name.endsWith('.min.json')) continue
      rmSync(path.join(locales, name), { force: true })
      removed.push(`packages/desktop/static/locales/${name}`)
    }
  }
  return removed
}

function runRelease(unpack: boolean): number {
  const target = releaseTarget(process.platform)
  if (!target) {
    console.error(`Unsupported platform: ${process.platform}`)
    return 1
  }
  const script = releaseScriptName(target, process.arch, unpack)
  console.log(`Running pnpm --filter marktext run ${script}`)
  const result = spawnSync('pnpm', ['--filter', 'marktext', 'run', script], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  return result.status ?? 1
}

function main(): void {
  const { command, unpack } = parseArgs(process.argv.slice(2))
  if (command === 'clean' || command === 'rebuild') {
    const removed = cleanWorkspace(repoRoot)
    if (removed.length === 0) console.log('Nothing to clean')
    else for (const relative of removed) console.log(`removed ${relative}`)
  }
  if (command === 'build' || command === 'rebuild') {
    process.exitCode = runRelease(unpack)
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (entry === fileURLToPath(import.meta.url)) main()
