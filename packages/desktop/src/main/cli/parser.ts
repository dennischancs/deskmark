import arg from 'arg'
import path from 'path'
import { isSamePathSync } from 'common/filesystem/paths'

/**
 * Parse the given arguments or the default program arguments.
 *
 * @param argv Arguments if null the default program arguments are used.
 * @param permissive If set to false an exception is throw about unknown flags.
 * @returns Parsed arguments
 */
const parseArgs = (argv: string[] | null = null, permissive: boolean = true) => {
  if (argv === null) {
    argv = process.argv.slice(1)
  }
  const spec = {
    '--debug': Boolean,
    '--safe': Boolean,

    '--new-window': Boolean,
    '-n': '--new-window',

    '--disable-gpu': Boolean,
    '--disable-spellcheck': Boolean,
    '--user-data-dir': String,

    // Misc
    '--help': Boolean,
    '-h': '--help',
    '--verbose': arg.COUNT,
    '-v': '--verbose',
    '--version': Boolean
  } satisfies arg.Spec
  return arg(spec, { argv, permissive })
}

// Electron puts the application directory on argv when launched as
// `electron <app> <user paths>`. That directory is not a note folder.
export function withoutApplicationDir(candidates: readonly string[], applicationDir: string): string[] {
  const root = path.resolve(applicationDir)
  return candidates.filter(item => !isSamePathSync(path.resolve(item), root))
}

export type ParsedArgs = ReturnType<typeof parseArgs>

export default parseArgs
