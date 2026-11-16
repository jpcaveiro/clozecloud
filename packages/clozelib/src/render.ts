import katex from 'katex';
import { decodeEntities } from './xml';
import type { ClozeField, FieldResult, GradeResult, Question } from './types';

export interface RenderOptions {
  /** Previously given answers (field order) to prefill. */
  answers?: ReadonlyArray<string | undefined>;
  /** Grading result: adds correctness classes, feedback and general feedback. */
  result?: GradeResult;
  disabled?: boolean;
}

const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function sanitize(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2$2');
}

/** Render math delimited by $...$, $$...$$, \(...\) and \[...\] inside an HTML fragment. */
export function renderMath(html: string): string {
  let out = '';
  let last = 0;
  for (const m of html.matchAll(MATH)) {
    const display = m[1] !== undefined || m[2] !== undefined;
    const tex = decodeEntities((m[1] ?? m[2] ?? m[3] ?? m[4] ?? '').replace(/<br\s*\/?>/gi, ' ')).trim();
    out += sanitize(html.slice(last, m.index));
    try {
      out += katex.renderToString(tex, { displayMode: display, throwOnError: false });
    } catch {
      out += esc(m[0]);
    }
    last = m.index! + m[0].length;
  }
  return out + sanitize(html.slice(last));
}

function renderField(f: ClozeField, value: string, r: FieldResult | undefined, disabled: boolean): string {
  const state = r ? (r.correct ? ' clz-correct' : r.fraction > 0 ? ' clz-partial' : ' clz-wrong') : '';
  const dis = disabled ? ' disabled' : '';
  const name = `clz-f${f.index}`;
  let control: string;
  if (f.kind === 'multichoice' && f.layout === 'dropdown') {
    const opts = ['', ...f.options.map((o) => o.text)]
      .map((t) => `<option value="${esc(t)}"${t === value ? ' selected' : ''}>${renderMath(esc(t))}</option>`)
      .join('');
    control = `<select data-field="${f.index}"${dis}>${opts}</select>`;
  } else if (f.kind === 'multichoice') {
    const items = f.options
      .map(
        (o) =>
          `<label class="clz-choice"><input type="radio" name="${name}" data-field="${f.index}" value="${esc(o.text)}"${
            o.text === value ? ' checked' : ''
          }${dis}> ${renderMath(esc(o.text))}</label>`,
      )
      .join(f.layout === 'vertical' ? '<br>' : ' ');
    control = `<span class="clz-choices clz-${f.layout}">${items}</span>`;
  } else {
    control = `<input type="text" data-field="${f.index}" value="${esc(value)}" autocomplete="off" spellcheck="false" size="${
      f.kind === 'numerical' ? 10 : 16
    }"${dis}>`;
  }
  const fb = r?.feedback ? `<span class="clz-fb">${renderMath(r.feedback)}</span>` : '';
  const label = r && !r.answered ? '' : r?.correct ? '✔ Correto' : r && r.fraction > 0 ? '◐ Parcialmente correto' : r ? '✘ Incorreto' : '';
  const status = label ? `<span class="clz-status">${label}</span>` : '';
  const solution = r && !r.correct ? `<span class="clz-expected" hidden>${renderMath(esc(r.expected))}</span>` : '';
  return `<span class="clz-field${state}">${control}${status}${fb}${solution}</span>`;
}

/** Render a question to an HTML string with KaTeX math and form controls (`data-field` = field index). */
export function renderQuestion(q: Question, opts: RenderOptions = {}): string {
  const body = q.parts
    .map((p) =>
      p.kind === 'text'
        ? renderMath(p.html)
        : renderField(p.field, opts.answers?.[p.field.index - 1] ?? '', opts.result?.fields[p.field.index - 1], !!opts.disabled),
    )
    .join('');
  const general = opts.result && q.generalFeedback.trim() ? `<div class="clz-general">${renderMath(q.generalFeedback)}</div>` : '';
  return `<div class="clz-question"><div class="clz-text">${body}</div>${general}</div>`;
}
