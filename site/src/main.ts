import 'katex/dist/katex.min.css';
import './style.css';
import { gradeAnswer, parseQuiz, renderQuestion } from 'clozelib';
import type { Quiz } from 'clozelib';
import * as store from './store';

interface Entry {
  path: string;
  title: string;
  questions: number;
  modified: string;
  hash: string;
}

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById('app')!;
let entries: Entry[] = [];
let progress = store.load();
const quizCache = new Map<string, Promise<Quiz>>();

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idOf = (e: Entry) => e.path;
const encPath = (s: string) => s.split('/').map(encodeURIComponent).join('/');
const exHref = (e: Entry, q = 0) => `#/ex/${encPath(idOf(e))}/${q}`;

function loadQuiz(e: Entry): Promise<Quiz> {
  const id = idOf(e);
  let p = quizCache.get(id);
  if (!p) {
    p = fetch(`${BASE}data/${encPath(id)}?h=${e.hash.slice(0, 12)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(parseQuiz);
    quizCache.set(id, p);
  }
  return p;
}

function stats(e: Entry) {
  const qs = progress.exercises[idOf(e)]?.hash === e.hash ? progress.exercises[idOf(e)]!.questions : {};
  const answered = Object.keys(qs).length;
  const correct = Object.values(qs).filter((s) => s.correct).length;
  return { answered, correct };
}

function qStateOf(e: Entry, q: number) {
  return store.getQ(progress, idOf(e), q, e.hash);
}

/* ---------- sidebar tree ---------- */

interface Dir {
  dirs: Map<string, Dir>;
  files: Entry[];
}

function buildTree(list: Entry[]): Dir {
  const root: Dir = { dirs: new Map(), files: [] };
  for (const e of list) {
    let d = root;
    for (const seg of e.path.split('/').slice(0, -1)) {
      if (!d.dirs.has(seg)) d.dirs.set(seg, { dirs: new Map(), files: [] });
      d = d.dirs.get(seg)!;
    }
    d.files.push(e);
  }
  return root;
}

function renderDir(d: Dir, current: Entry | undefined, depth = 0): string {
  let html = '';
  for (const [name, sub] of d.dirs) {
    const open = depth === 0 || (current && sub.files.concat(...flatten(sub)).includes(current)) ? ' open' : '';
    html += `<details${open}><summary>${esc(name)}</summary>${renderDir(sub, current, depth + 1)}</details>`;
  }
  for (const e of d.files) {
    const s = stats(e);
    const cls = s.correct === e.questions && e.questions > 0 ? 'done' : s.answered ? 'partial' : '';
    html += `<a class="ex ${cls}${e === current ? ' current' : ''}" href="${exHref(e)}">${esc(e.title)}<small>${s.correct}/${e.questions}</small></a>`;
  }
  return html;
}

function flatten(d: Dir): Entry[] {
  return [...d.files, ...[...d.dirs.values()].flatMap(flatten)];
}

function shell(current: Entry | undefined, content: string): void {
  const last = progress.last && entries.find((e) => idOf(e) === progress.last!.id);
  app.innerHTML = `
    <header>
      <a class="brand" href="#/">clozecloud</a>
      <nav>
        <a href="#/">Exercícios</a>
        <a href="#/progress">Progresso</a>
        ${last ? `<a href="${exHref(last, progress.last!.q)}">Continuar</a>` : ''}
      </nav>
    </header>
    <div class="layout">
      <aside>${renderDir(buildTree(entries), current)}</aside>
      <main>${content}</main>
    </div>`;
}

/* ---------- views ---------- */

function homeView(): void {
  const rows = entries
    .map((e) => {
      const s = stats(e);
      return `<tr><td><a href="${exHref(e)}">${esc(e.path)}</a></td><td>${esc(e.title)}</td><td>${e.questions}</td><td>${s.correct}/${e.questions}</td><td>${esc(e.modified.slice(0, 10))}</td></tr>`;
    })
    .join('');
  shell(
    undefined,
    entries.length
      ? `<h1>Exercícios</h1><table><thead><tr><th>Caminho</th><th>Título</th><th>Questões</th><th>Corretas</th><th>Atualizado</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<h1>Exercícios</h1><p>Ainda não há exercícios publicados.</p>',
  );
}

function progressView(): void {
  const rows = entries
    .map((e) => {
      const dots = Array.from({ length: e.questions }, (_, q) => {
        const s = qStateOf(e, q);
        return `<a class="dot ${s ? (s.correct ? 'ok' : 'bad') : ''}" href="${exHref(e, q)}" title="Q${q + 1}">${q + 1}</a>`;
      }).join('');
      const s = stats(e);
      return `<tr><td>${esc(idOf(e))}</td><td>${s.answered}/${e.questions}</td><td>${s.correct}</td><td>${dots}</td></tr>`;
    })
    .join('');
  const total = entries.reduce((n, e) => n + e.questions, 0);
  const correct = entries.reduce((n, e) => n + stats(e).correct, 0);
  shell(
    undefined,
    `<h1>Progresso</h1>
     <p>${correct} de ${total} questões respondidas corretamente.</p>
     <p class="actions">
       <button id="export">Exportar JSON</button>
       <label class="button">Importar JSON<input id="import" type="file" accept="application/json,.json" hidden></label>
       <button id="reset" class="danger">Apagar progresso</button>
     </p>
     <p id="msg" role="status"></p>
     <table><thead><tr><th>Exercício</th><th>Respondidas</th><th>Corretas</th><th>Questões</th></tr></thead><tbody>${rows}</tbody></table>`,
  );
  const msg = document.getElementById('msg')!;
  document.getElementById('export')!.onclick = () => {
    const url = URL.createObjectURL(new Blob([store.exportJson(progress)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `clozecloud-progress-${new Date().toISOString().slice(0, 10)}.json`,
    });
    a.click();
    URL.revokeObjectURL(url);
  };
  (document.getElementById('import') as HTMLInputElement).onchange = async (ev) => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const n = store.importJson(progress, await file.text());
      progress = store.load();
      route();
      document.getElementById('msg')!.textContent = `${n} resposta(s) importada(s).`;
    } catch (err) {
      msg.textContent = `Falha na importação: ${(err as Error).message}`;
    }
  };
  document.getElementById('reset')!.onclick = () => {
    if (confirm('Apagar todo o progresso guardado neste dispositivo?')) {
      progress = store.reset();
      route();
    }
  };
}

/** Position in the global (exercise, question) sequence, for free movement through the whole space. */
function neighbour(idx: number, q: number, dir: 1 | -1): { e: Entry; q: number } | undefined {
  const flat = entries.flatMap((e, i) => Array.from({ length: e.questions }, (_, n) => ({ e, i, q: n })));
  const pos = flat.findIndex((p) => p.i === idx && p.q === q);
  const t = flat[pos + dir];
  return t && { e: t.e, q: t.q };
}

function nextUnanswered(idx: number, q: number): { e: Entry; q: number } | undefined {
  const flat = entries.flatMap((e) => Array.from({ length: e.questions }, (_, n) => ({ e, q: n })));
  const pos = flat.findIndex((p) => p.e === entries[idx] && p.q === q);
  for (let k = 1; k <= flat.length; k++) {
    const t = flat[(pos + k) % flat.length]!;
    if (!qStateOf(t.e, t.q)) return t;
  }
  return undefined;
}

async function exerciseView(id: string, qIndex: number): Promise<void> {
  const idx = entries.findIndex((e) => idOf(e) === id);
  const entry = entries[idx];
  if (!entry) {
    shell(undefined, `<p>Exercício não encontrado: ${esc(id)}</p>`);
    return;
  }
  shell(entry, '<p>A carregar…</p>');
  let quiz: Quiz;
  try {
    quiz = await loadQuiz(entry);
  } catch (err) {
    document.querySelector('main')!.innerHTML = `<p>Não foi possível carregar o exercício: ${esc((err as Error).message)}</p>`;
    return;
  }
  const q = Math.min(Math.max(qIndex, 0), quiz.questions.length - 1);
  const question = quiz.questions[q];
  if (!question) {
    document.querySelector('main')!.innerHTML = '<p>Este exercício não tem questões.</p>';
    return;
  }
  store.setLast(progress, id, q);

  const prev = neighbour(idx, q, -1);
  const next = neighbour(idx, q, 1);
  const unanswered = nextUnanswered(idx, q);
  const go = (t?: { e: Entry; q: number }) => (t ? `href="${exHref(t.e, t.q)}"` : 'class="disabled" aria-disabled="true"');
  const prevEx = entries[idx - 1];
  const nextEx = entries[idx + 1];
  const jump = quiz.questions
    .map((_, n) => {
      const s = qStateOf(entry, n);
      return `<a class="dot ${s ? (s.correct ? 'ok' : 'bad') : ''}${n === q ? ' current' : ''}" href="${exHref(entry, n)}">${n + 1}</a>`;
    })
    .join('');

  const main = document.querySelector('main')!;
  main.innerHTML = `
    <p class="crumb">${esc(idOf(entry))}</p>
    <h1>${esc(question.name || entry.title)} <small>${q + 1} / ${quiz.questions.length}</small></h1>
    <div class="jump">${jump}</div>
    <form id="qform"><div id="qbody"></div>
      <p class="actions">
        <button type="submit">Verificar</button>
        <button type="button" id="solution">Mostrar solução</button>
        <span id="score"></span>
      </p>
    </form>
    <nav class="pager">
      <a ${go(prev)}>← Anterior</a>
      <a ${go(next)}>Seguinte →</a>
      <span class="sep"></span>
      <a ${prevEx ? `href="${exHref(prevEx)}"` : 'class="disabled"'}>⇤ Exercício anterior</a>
      <a ${nextEx ? `href="${exHref(nextEx)}"` : 'class="disabled"'}>Exercício seguinte ⇥</a>
      <a ${go(unanswered)}>Próxima por responder</a>
      <a href="#" id="random">Aleatória</a>
    </nav>`;

  const body = document.getElementById('qbody')!;
  const scoreEl = document.getElementById('score')!;
  const saved = qStateOf(entry, q);
  const show = (answers: string[], graded: boolean) => {
    const result = graded ? gradeAnswer(question, answers) : undefined;
    body.innerHTML = renderQuestion(question, { answers, result });
    if (result) scoreEl.textContent = result.correct ? '✔ Correto' : `Pontuação: ${Math.round(result.score * 100)}%`;
    return result;
  };
  show(saved?.answers ?? [], !!saved);

  const collect = () =>
    question.fields.map((f) => {
      const els = [...body.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-field="${f.index}"]`)];
      const radio = els.find((el) => el instanceof HTMLInputElement && el.type === 'radio' && el.checked);
      return (radio ?? els.find((el) => !(el instanceof HTMLInputElement && el.type === 'radio')))?.value ?? '';
    });

  document.getElementById('qform')!.onsubmit = (ev) => {
    ev.preventDefault();
    const answers = collect();
    const result = show(answers, true)!;
    store.record(progress, id, entry.hash, q, answers, result);
    document.querySelectorAll('aside .ex.current small').forEach((el) => (el.textContent = `${stats(entry).correct}/${entry.questions}`));
    document.querySelectorAll('.jump .dot.current').forEach((el) => el.classList.add(result.correct ? 'ok' : 'bad'));
  };
  document.getElementById('solution')!.onclick = () => {
    const answers = collect();
    show(answers, true);
    body.querySelectorAll<HTMLElement>('.clz-expected').forEach((el) => (el.hidden = false));
  };
  document.getElementById('random')!.onclick = (ev) => {
    ev.preventDefault();
    const flat = entries.flatMap((e) => Array.from({ length: e.questions }, (_, n) => ({ e, q: n })));
    const t = flat[Math.floor(Math.random() * flat.length)];
    if (t) location.hash = exHref(t.e, t.q);
  };
  currentNav = { prev, next };
}

let currentNav: { prev?: { e: Entry; q: number }; next?: { e: Entry; q: number } } = {};

document.addEventListener('keydown', (ev) => {
  const t = ev.target as HTMLElement;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const target = ev.key === 'ArrowLeft' ? currentNav.prev : ev.key === 'ArrowRight' ? currentNav.next : undefined;
  if (target) location.hash = exHref(target.e, target.q);
});

/* ---------- router ---------- */

function route(): void {
  currentNav = {};
  const hash = location.hash;
  const m = /^#\/ex\/(.+?)(?:\/(\d+))?$/.exec(hash);
  if (m) void exerciseView(decodeURIComponent(m[1]!), Number(m[2] ?? 0));
  else if (hash === '#/progress') progressView();
  else homeView();
}

async function main() {
  try {
    const r = await fetch(`${BASE}index.json`, { cache: 'no-cache' });
    entries = ((await r.json()) as { exercises: Entry[] }).exercises;
  } catch {
    app.textContent = 'Não foi possível carregar index.json';
    return;
  }
  window.addEventListener('hashchange', route);
  route();
}

void main();
