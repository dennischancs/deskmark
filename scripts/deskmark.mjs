#!/usr/bin/env node
// One entry for Windows, macOS, and Linux. The actual clean and package
// steps stay in workspace.ts so the two do not drift.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const usage = `用法（Windows、macOS、Linux 相同，在仓库根目录执行）：

  node scripts/deskmark.mjs clean [--installers]
  node scripts/deskmark.mjs build [--unpack]
  node scripts/deskmark.mjs rebuild [--unpack] [--installers]

clean     删掉这次编译的中间文件、解包目录、测试输出和调试日志。
          已经打好的安装包留在 dist/。node_modules 不动。
build     按当前系统打安装包。Windows 普通机器打 x64，ARM 机器打 arm64。
          macOS 和 Linux 只能在各自的系统上打，不能互相代打。
rebuild   先 clean，再 build。
--installers  连 dist/ 里已有的安装包一起删。只能跟 clean 或 rebuild。
--unpack      只编译，不打安装包。只能跟 build 或 rebuild。
`

function tsxCli() {
  const require = createRequire(path.join(root, 'package.json'))
  try {
    return path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs')
  } catch {
    return ''
  }
}

const args = process.argv.slice(2)
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  process.stdout.write(usage)
  process.exit(args.length === 0 ? 1 : 0)
}

const cli = tsxCli()
if (!cli) {
  process.stderr.write('找不到 tsx。先在仓库根目录执行 pnpm install。\n')
  process.exit(1)
}

const result = spawnSync(process.execPath, [cli, path.join(root, 'scripts', 'workspace.ts'), ...args], {
  cwd: root,
  stdio: 'inherit'
})
process.exit(result.status ?? 1)
