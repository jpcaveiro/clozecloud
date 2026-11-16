import { parseCloze } from './cloze';
import { child, childText, parseXml } from './xml';
import type { Question, Quiz } from './types';

/** Parse a Moodle XML export. Cloze questions are fully parsed; other types keep their text only. */
export function parseQuiz(xml: string): Quiz {
  const root = child(parseXml(xml), 'quiz');
  if (!root) throw new Error('Not a Moodle XML file: missing <quiz> element');
  const quiz: Quiz = { questions: [] };
  for (const q of root.children) {
    if (q.name !== 'question') continue;
    const type = q.attrs.type ?? '';
    if (type === 'category') {
      quiz.category ??= childText(q, 'category', 'text').trim();
      continue;
    }
    const text = childText(q, 'questiontext', 'text');
    const parsed = type === 'cloze' ? parseCloze(text) : { parts: [{ kind: 'text' as const, html: text }], fields: [] };
    const grade = parseFloat(childText(q, 'defaultgrade'));
    const question: Question = {
      type,
      name: childText(q, 'name', 'text').trim(),
      text,
      generalFeedback: childText(q, 'generalfeedback', 'text'),
      defaultGrade: Number.isFinite(grade) ? grade : 1,
      ...parsed,
    };
    quiz.questions.push(question);
  }
  return quiz;
}
