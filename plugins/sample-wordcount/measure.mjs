const COPY = {
  de: {
    chars: 'Zeichen',
    words: 'Wörter',
    lines: 'Zeilen',
    empty: 'Öffne eine Notiz, dann steht hier die Länge.',
    failed: 'Diese Notiz konnte nicht gelesen werden.'
  },
  en: {
    chars: 'Characters',
    words: 'Words',
    lines: 'Lines',
    empty: 'Open a note to count it.',
    failed: 'This note could not be read.'
  },
  es: {
    chars: 'Caracteres',
    words: 'Palabras',
    lines: 'Líneas',
    empty: 'Abre una nota para ver su longitud.',
    failed: 'No se pudo leer esta nota.'
  },
  fr: {
    chars: 'Caractères',
    words: 'Mots',
    lines: 'Lignes',
    empty: 'Ouvrez une note pour voir sa longueur.',
    failed: 'Cette note n\'a pas pu être lue.'
  },
  ja: {
    chars: '文字',
    words: '単語',
    lines: '行',
    empty: 'ノートを開くと、ここで文字数を数えます。',
    failed: 'このノートは読めませんでした。'
  },
  ko: {
    chars: '글자',
    words: '단어',
    lines: '줄',
    empty: '노트를 열면 여기서 길이를 셉니다.',
    failed: '이 노트를 읽지 못했습니다.'
  },
  nl: {
    chars: 'Tekens',
    words: 'Woorden',
    lines: 'Regels',
    empty: 'Open een notitie om de lengte te zien.',
    failed: 'Deze notitie kon niet worden gelezen.'
  },
  pt: {
    chars: 'Caracteres',
    words: 'Palavras',
    lines: 'Linhas',
    empty: 'Abra uma nota para ver o tamanho.',
    failed: 'Não foi possível ler esta nota.'
  },
  ru: {
    chars: 'Знаки',
    words: 'Слова',
    lines: 'Строки',
    empty: 'Откройте заметку, и здесь будет длина.',
    failed: 'Эту заметку не удалось прочитать.'
  },
  tr: {
    chars: 'Karakter',
    words: 'Sözcük',
    lines: 'Satır',
    empty: 'Uzunluğu görmek için bir not açın.',
    failed: 'Bu not okunamadı.'
  },
  'zh-CN': {
    chars: '字符',
    words: '词',
    lines: '行',
    empty: '先打开一篇笔记，这里才会计字数。',
    failed: '这篇笔记没能读到。'
  },
  'zh-TW': {
    chars: '字元',
    words: '詞',
    lines: '行',
    empty: '先打開一篇筆記，這裡才會計字數。',
    failed: '這篇筆記沒能讀到。'
  }
}

const CJK = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/gu

export function copyFor(lang) {
  const key = String(lang || 'en')
  if (COPY[key]) return COPY[key]
  const folded = key.toLowerCase()
  const base = folded.split('-')[0]
  if (base === 'zh') {
    return folded.includes('tw') || folded.includes('hk') || folded.includes('hant')
      ? COPY['zh-TW']
      : COPY['zh-CN']
  }
  return COPY[base] || COPY.en
}

export function prefersCharacters(lang) {
  const base = String(lang || '').toLowerCase().split('-')[0]
  return base === 'zh' || base === 'ja' || base === 'ko'
}

export function measureText(text) {
  const source = String(text ?? '').replace(/\r\n/g, '\n')
  const chars = [...source.replace(/\s/g, '')].length
  const trimmed = source.replace(/\n+$/, '')
  const lines = trimmed.trim() ? trimmed.split('\n').length : 0
  const cjk = source.match(CJK)
  const rest = source.replace(CJK, ' ').match(/[\p{L}\p{N}]+/gu)
  return {
    chars,
    words: (cjk?.length || 0) + (rest?.length || 0),
    lines
  }
}

export function formatCount(value, lang) {
  try {
    return Number(value).toLocaleString(lang || 'en')
  } catch {
    return String(value)
  }
}

export function presentNote({ markdown = '', path = '', lang = 'en', state = 'empty' } = {}) {
  const copy = copyFor(lang)
  if (state !== 'ready') {
    return {
      value: '-',
      unit: '',
      rows: [],
      path: '',
      hint: state === 'failed' ? copy.failed : copy.empty
    }
  }
  const measured = measureText(markdown)
  const characters = prefersCharacters(lang)
  const file = String(path || '').split('/').pop() || ''
  return {
    value: formatCount(characters ? measured.chars : measured.words, lang),
    unit: characters ? copy.chars : copy.words,
    rows: [
      { name: copy.chars, value: formatCount(measured.chars, lang) },
      { name: copy.words, value: formatCount(measured.words, lang) },
      { name: copy.lines, value: formatCount(measured.lines, lang) }
    ],
    path: file,
    hint: ''
  }
}
