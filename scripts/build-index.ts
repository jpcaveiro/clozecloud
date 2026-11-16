import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuiz } from '../packages/clozelib/src/index';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outDir = join(root, 'site', 'public');

export interface IndexEntry {
  /** Path relative to data/, with forward slashes. */
  path: string;
  title: string;
  questions: number;
  modified: string;
  hash: string;
}

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && e.name.toLowerCase().endsWith('.xml')) yield p;
  }
}

function modifiedDate(file: string): string {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { cwd: root, encoding: 'utf8' }).trim();
    if (out) return out;
  } catch {
    /* not a git checkout */
  }
  return statSync(file).mtime.toISOString();
}

const entries: IndexEntry[] = [];
if (existsSync(dataDir)) {
  for (const file of walk(dataDir)) {
    const rel = relative(dataDir, file).split('\\').join('/');
    const content = readFileSync(file);
    try {
      const quiz = parseQuiz(content.toString('utf8'));
      entries.push({
        path: rel,
        title: quiz.questions[0]?.name || rel.replace(/\.xml$/i, '').split('/').pop()!,
        questions: quiz.questions.length,
        modified: modifiedDate(file),
        hash: createHash('sha256').update(content).digest('hex'),
      });
    } catch (err) {
      console.warn(`skipping ${rel}: ${(err as Error).message}`);
    }
  }
}
entries.sort((a, b) => a.path.localeCompare(b.path));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.json'), JSON.stringify({ generated: new Date().toISOString(), exercises: entries }, null, 2));
rmSync(join(outDir, 'data'), { recursive: true, force: true });
if (existsSync(dataDir)) cpSync(dataDir, join(outDir, 'data'), { recursive: true });
console.log(`index.json: ${entries.length} exercise file(s)`);
