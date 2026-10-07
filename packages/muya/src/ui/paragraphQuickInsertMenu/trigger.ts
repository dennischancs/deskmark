// A paragraph keeps a trailing newline in its text. The slash and mention
// checks are about the visible line, so that newline must not hide the menu.

export function paragraphLine(text: string): string {
    return text.endsWith('\n') ? text.slice(0, -1) : text;
}

export function quickInsertQuery(text: string): string | null {
    const line = paragraphLine(text);
    return /^[/、]\S*$/.test(line) ? line.slice(1) : null;
}

export function isBareSlash(text: string): boolean {
    const line = paragraphLine(text);
    return line === '/' || line === '、';
}

export function mentionQuery(text: string): string | null {
    const line = paragraphLine(text);
    if (!/(?:^|\s)@\S*$/.test(line) || /\w@\S*$/.test(line))
        return null;
    return /(?:^|\s)@(\S*)$/.exec(line)?.[1] ?? '';
}
