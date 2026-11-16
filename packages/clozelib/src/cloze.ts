import type { ClozeField, ClozeOption, ClozePart, FieldKind, FieldLayout, ParsedCloze } from './types';

interface TypeInfo {
  kind: FieldKind;
  layout: FieldLayout;
  caseSensitive: boolean;
  shuffle: boolean;
}

const TYPES: Record<string, TypeInfo> = {};
function def(names: string[], info: TypeInfo) {
  for (const n of names) TYPES[n] = info;
}
def(['NUMERICAL', 'NM'], { kind: 'numerical', layout: 'dropdown', caseSensitive: false, shuffle: false });
def(['SHORTANSWER', 'SA', 'MW'], { kind: 'shortanswer', layout: 'dropdown', caseSensitive: false, shuffle: false });
def(['SHORTANSWER_C', 'SAC', 'MWC'], { kind: 'shortanswer', layout: 'dropdown', caseSensitive: true, shuffle: false });
const MC = { kind: 'multichoice', caseSensitive: false } as const;
def(['MULTICHOICE', 'MC'], { ...MC, layout: 'dropdown', shuffle: false });
def(['MULTICHOICE_S', 'MCS'], { ...MC, layout: 'dropdown', shuffle: true });
def(['MULTICHOICE_V', 'MCV'], { ...MC, layout: 'vertical', shuffle: false });
def(['MULTICHOICE_VS', 'MCVS'], { ...MC, layout: 'vertical', shuffle: true });
def(['MULTICHOICE_H', 'MCH'], { ...MC, layout: 'horizontal', shuffle: false });
def(['MULTICHOICE_HS', 'MCHS'], { ...MC, layout: 'horizontal', shuffle: true });

const HEAD = /^\{(\d*):([A-Za-z_]+):/;

/** Index of the first unescaped `}` at or after `from`, or -1. */
function findClose(s: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '}') return i;
  }
  return -1;
}

function splitUnescaped(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '\\' && i + 1 < s.length) {
      cur += c + s[i + 1];
      i++;
    } else if (c === sep) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const unescape = (s: string) => s.replace(/\\([}#~])/g, '$1');

function parseOption(raw: string, kind: FieldKind): ClozeOption {
  let s = raw.trim();
  let fraction = 0;
  const pct = /^%(-?\d+(?:\.\d+)?)%/.exec(s);
  if (pct) {
    fraction = parseFloat(pct[1]!);
    s = s.slice(pct[0].length);
  } else if (s.startsWith('=')) {
    fraction = 100;
    s = s.slice(1);
  }
  const [answerRaw = '', ...fb] = splitUnescaped(s, '#');
  const answer = unescape(answerRaw).trim();
  const opt: ClozeOption = { text: answer, fraction, feedback: unescape(fb.join('#')).trim() };
  if (kind === 'numerical' && answer !== '*') {
    const colon = answer.lastIndexOf(':');
    const valueStr = colon >= 0 ? answer.slice(0, colon) : answer;
    const value = Number(valueStr.trim().replace(',', '.'));
    if (Number.isFinite(value)) {
      opt.text = valueStr.trim();
      opt.value = value;
      opt.tolerance = colon >= 0 ? Math.abs(Number(answer.slice(colon + 1).trim().replace(',', '.')) || 0) : 0;
    }
  }
  return opt;
}

/** Parse Moodle Cloze text into ordered text and field parts. */
export function parseCloze(text: string): ParsedCloze {
  const parts: ClozePart[] = [];
  const fields: ClozeField[] = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      const m = HEAD.exec(text.slice(i, i + 40));
      const info = m ? TYPES[m[2]!.toUpperCase()] : undefined;
      if (m && info) {
        const bodyStart = i + m[0].length;
        const end = findClose(text, bodyStart);
        if (end >= 0) {
          if (buf) parts.push({ kind: 'text', html: buf });
          buf = '';
          const field: ClozeField = {
            index: fields.length + 1,
            ...info,
            weight: m[1] ? parseInt(m[1], 10) : 1,
            options: splitUnescaped(text.slice(bodyStart, end), '~')
              .filter((o) => o.trim() !== '')
              .map((o) => parseOption(o, info.kind)),
          };
          fields.push(field);
          parts.push({ kind: 'field', field });
          i = end + 1;
          continue;
        }
      }
    }
    buf += text[i];
    i++;
  }
  if (buf) parts.push({ kind: 'text', html: buf });
  return { parts, fields };
}
