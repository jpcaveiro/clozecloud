import type { GradeResult } from 'clozelib';

export interface QState {
  answers: string[];
  score: number;
  correct: boolean;
  attempts: number;
  updated: string;
}

export interface ExState {
  /** Content hash of the exercise file when the answers were given. */
  hash: string;
  questions: Record<string, QState>;
}

export interface Progress {
  version: 1;
  exercises: Record<string, ExState>;
  last?: { id: string; q: number };
}

const KEY = 'clozecloud.progress.v1';
const empty = (): Progress => ({ version: 1, exercises: {} });

export function load(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (p && p.version === 1 && typeof p.exercises === 'object') return p as Progress;
  } catch {
    /* corrupt state: start fresh */
  }
  return empty();
}

export function save(p: Progress): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function getQ(p: Progress, id: string, q: number, hash?: string): QState | undefined {
  const ex = p.exercises[id];
  if (!ex || (hash !== undefined && ex.hash !== hash)) return undefined;
  return ex.questions[q];
}

export function record(p: Progress, id: string, hash: string, q: number, answers: string[], r: GradeResult): void {
  let ex = p.exercises[id];
  // Exercise changed upstream: earlier answers no longer apply.
  if (!ex || ex.hash !== hash) ex = p.exercises[id] = { hash, questions: {} };
  const prev = ex.questions[q];
  ex.questions[q] = {
    answers,
    score: r.score,
    correct: r.correct,
    attempts: (prev?.attempts ?? 0) + 1,
    updated: new Date().toISOString(),
  };
  save(p);
}

export function setLast(p: Progress, id: string, q: number): void {
  p.last = { id, q };
  save(p);
}

export function exportJson(p: Progress): string {
  return JSON.stringify(p, null, 2);
}

/** Merge an exported file into the current progress; the most recently updated answer wins. */
export function importJson(p: Progress, text: string): number {
  const inc = JSON.parse(text) as Progress;
  if (inc?.version !== 1 || typeof inc.exercises !== 'object') throw new Error('Not a clozecloud progress file');
  let merged = 0;
  for (const [id, ex] of Object.entries(inc.exercises)) {
    const cur = p.exercises[id];
    if (!cur) {
      p.exercises[id] = ex;
      merged += Object.keys(ex.questions).length;
      continue;
    }
    const newer = (a: QState, b?: QState) => !b || a.updated > b.updated;
    if (cur.hash !== ex.hash) {
      const latest = (e: ExState) => Object.values(e.questions).reduce((m, s) => (s.updated > m ? s.updated : m), '');
      if (latest(ex) > latest(cur)) {
        p.exercises[id] = ex;
        merged += Object.keys(ex.questions).length;
      }
      continue;
    }
    for (const [q, s] of Object.entries(ex.questions)) {
      if (newer(s, cur.questions[q])) {
        cur.questions[q] = s;
        merged++;
      }
    }
  }
  if (inc.last && !p.last) p.last = inc.last;
  save(p);
  return merged;
}

export function reset(): Progress {
  localStorage.removeItem(KEY);
  return empty();
}
