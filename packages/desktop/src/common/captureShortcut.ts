export const DEFAULT_CAPTURE_ACCELERATOR = 'CommandOrControl+Alt+N'

const TOKEN = /^(?:CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|AltGr|Shift|Super|Plus|Space|Tab|Backspace|Delete|Insert|Return|Enter|Up|Down|Left|Right|Home|End|PageUp|PageDown|Escape|Esc|F(?:[1-9]|1[0-9]|2[0-4])|[A-Z0-9])$/
const MODIFIER = /^(?:CommandOrControl|CmdOrCtrl|Command|Cmd|Control|Ctrl|Alt|Option|AltGr|Shift|Super)$/

// Empty turns the shortcut off. Anything that is not a modified accelerator
// falls back to the default so a bare letter cannot capture normal typing.
export function normalizeCaptureAccelerator(value: unknown): string {
  if (value == null) return DEFAULT_CAPTURE_ACCELERATOR
  if (typeof value !== 'string') return DEFAULT_CAPTURE_ACCELERATOR
  const trimmed = value.trim()
  if (!trimmed) return ''
  const parts = trimmed.split('+').map(part => part.trim()).filter(Boolean)
  if (parts.length < 2 || parts.length > 4) return DEFAULT_CAPTURE_ACCELERATOR
  if (!parts.every(part => TOKEN.test(part))) return DEFAULT_CAPTURE_ACCELERATOR
  if (!parts.slice(0, -1).some(part => MODIFIER.test(part))) return DEFAULT_CAPTURE_ACCELERATOR
  return parts.join('+')
}
