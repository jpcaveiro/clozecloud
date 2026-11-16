import type { ClozeField, ClozeOption, FieldResult, GradeResult, Question } from './types';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

function wildcardMatch(pattern: string, value: string, caseSensitive: boolean): boolean {
  const re = pattern
    .split('*')
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${re}$`, caseSensitive ? 's' : 'is').test(value);
}

function matches(field: ClozeField, opt: ClozeOption, answer: string): boolean {
  if (field.kind === 'numerical') {
    if (opt.text === '*') return true;
    const n = Number(answer.replace(',', '.'));
    if (answer === '' || !Number.isFinite(n) || opt.value === undefined) return false;
    const tol = (opt.tolerance ?? 0) + Math.abs(opt.value) * 1e-12;
    return Math.abs(n - opt.value) <= tol;
  }
  if (field.kind === 'multichoice') return norm(opt.text) === answer;
  return wildcardMatch(norm(opt.text), answer, field.caseSensitive);
}

export function gradeField(field: ClozeField, raw: string | undefined): FieldResult {
  const answer = norm(raw ?? '');
  const best = field.options.reduce<ClozeOption | undefined>(
    (b, o) => (o.fraction > (b?.fraction ?? -Infinity) ? o : b),
    undefined,
  );
  const base = { index: field.index, expected: best?.text ?? '' };
  if (answer === '') return { ...base, answered: false, fraction: 0, correct: false, feedback: '' };
  // The first matching option wins, as in Moodle.
  const hit = field.options.find((o) => matches(field, o, answer));
  const fraction = hit ? hit.fraction : 0;
  return { ...base, answered: true, fraction, correct: fraction >= 100, feedback: hit?.feedback ?? '' };
}

/** Grade answers (one string per field, in field order; multichoice answers are the option text). */
export function gradeAnswer(q: Question, answers: ReadonlyArray<string | undefined>): GradeResult {
  const fields = q.fields.map((f, i) => gradeField(f, answers[i]));
  const total = q.fields.reduce((s, f) => s + f.weight, 0);
  const got = q.fields.reduce((s, f, i) => s + (f.weight * Math.max(0, fields[i]!.fraction)) / 100, 0);
  return {
    score: total > 0 ? got / total : 0,
    correct: fields.length > 0 && fields.every((f) => f.correct),
    fields,
  };
}
