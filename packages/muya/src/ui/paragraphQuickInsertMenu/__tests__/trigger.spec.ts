import { describe, expect, it } from 'vitest';
import { isBareSlash, mentionQuery, quickInsertQuery } from '../trigger';

describe('quick insert trigger', () => {
    it('opens for a slash line that still has the paragraph newline', () => {
        expect(quickInsertQuery('/\n')).toBe('')
        expect(quickInsertQuery('//\n')).toBe('/')
        expect(quickInsertQuery('、待办\n')).toBe('待办')
        expect(isBareSlash('/\n')).toBe(true)
        expect(isBareSlash('//\n')).toBe(false)
    })

    it('does not open for ordinary text or an email', () => {
        expect(quickInsertQuery('买牛奶\n')).toBeNull()
        expect(mentionQuery('a@b.com\n')).toBeNull()
        expect(mentionQuery('@今天\n')).toBe('今天')
        expect(mentionQuery('买牛奶 @明天\n')).toBe('明天')
    })
})
