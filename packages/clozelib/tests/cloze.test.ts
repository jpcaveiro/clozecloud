import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gradeAnswer, parseCloze, parseQuiz, renderQuestion } from '../src';

const xml = readFileSync(new URL('./fixtures/sistema2x2.xml', import.meta.url), 'utf8');
const quiz = parseQuiz(xml);
const q1 = quiz.questions[0]!;

describe('parseCloze', () => {
  it('parses numerical with tolerance, partial credit and feedback', () => {
    const { fields } = parseCloze('{1:NUMERICAL:=3.14:0.01#pi~%50%3#close}');
    expect(fields[0]!.kind).toBe('numerical');
    expect(fields[0]!.options).toEqual([
      { text: '3.14', fraction: 100, feedback: 'pi', value: 3.14, tolerance: 0.01 },
      { text: '3', fraction: 50, feedback: 'close', value: 3, tolerance: 0 },
    ]);
  });

  it('parses multichoice layouts, weights and escaped braces', () => {
    const { fields, parts } = parseCloze('a {3:MCV:=x\\}y~z} b');
    expect(fields[0]).toMatchObject({ kind: 'multichoice', layout: 'vertical', weight: 3 });
    expect(fields[0]!.options[0]!.text).toBe('x}y');
    expect(parts.map((p) => p.kind)).toEqual(['text', 'field', 'text']);
  });

  it('leaves non-cloze braces (LaTeX) as text', () => {
    const { parts, fields } = parseCloze('$\\frac{1}{2}$ {1:SA:=a}');
    expect(fields).toHaveLength(1);
    expect(parts[0]).toEqual({ kind: 'text', html: '$\\frac{1}{2}$ ' });
  });
});

describe('parseQuiz', () => {
  it('reads category, names, grades and decodes entities', () => {
    expect(quiz.category).toBe('$course$/top/mne/numcap5');
    expect(quiz.questions.map((q) => q.name)).toEqual(['Sistema 2x2', 'Derivada & limite']);
    expect(q1.defaultGrade).toBe(5);
    expect(q1.fields).toHaveLength(5);
    expect(quiz.questions[1]!.text.startsWith('<p>')).toBe(true);
  });

  it('rejects non-Moodle XML', () => {
    expect(() => parseQuiz('<foo/>')).toThrow();
  });
});

describe('gradeAnswer', () => {
  const right = ['2', '1', 'possível e determinado', 'solução', 'B certa'];

  it('accepts a fully correct answer set', () => {
    const r = gradeAnswer(q1, right);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1);
    expect(r.fields[0]!.feedback).toBe('Certo');
  });

  it('applies numerical tolerance, decimal comma and partial credit', () => {
    expect(gradeAnswer(q1, ['2,005', ...right.slice(1)]).fields[0]!.correct).toBe(true);
    const partial = gradeAnswer(q1, ['2.4', ...right.slice(1)]).fields[0]!;
    expect(partial).toMatchObject({ fraction: 50, correct: false, feedback: 'Quase' });
  });

  it('uses wildcard options for feedback on wrong numbers', () => {
    const f = gradeAnswer(q1, ['2', '7', ...right.slice(2)]).fields[1]!;
    expect(f).toMatchObject({ fraction: 0, feedback: 'Verifique a segunda equação' });
  });

  it('matches shortanswer wildcards case-insensitively and weights fields', () => {
    const r = gradeAnswer(q1, ['2', '1', 'possível e determinado', 'SOLUÇÃO única', 'x']);
    expect(r.fields[3]!.correct).toBe(true);
    expect(r.fields[4]!.correct).toBe(false);
    expect(r.score).toBeCloseTo((1 + 1 + 1 + 2 + 0) / 6);
  });

  it('treats empty answers as unanswered and honours case-sensitive shortanswer', () => {
    expect(gradeAnswer(q1, []).fields.every((f) => !f.answered)).toBe(true);
    const q2 = quiz.questions[1]!;
    expect(gradeAnswer(q2, ['2x']).correct).toBe(true);
    expect(gradeAnswer(q2, ['2X']).correct).toBe(false);
  });
});

describe('renderQuestion', () => {
  it('renders KaTeX math and form controls', () => {
    const html = renderQuestion(q1);
    expect(html).toContain('class="katex"');
    expect(html).toContain('data-field="5"');
    expect(html).toContain('<select data-field="3">');
    expect(html).not.toContain('{1:NUMERICAL');
  });

  it('shows feedback and general feedback once graded', () => {
    const html = renderQuestion(q1, { result: gradeAnswer(q1, ['2']), disabled: true });
    expect(html).toContain('clz-correct');
    expect(html).toContain('clz-general');
  });
});
