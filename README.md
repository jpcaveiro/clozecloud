# clozecloud

Static site and TypeScript library to study Moodle Cloze exercises exported from pyequa.

## Layout
- `packages/clozelib` – `parseQuiz`, `parseCloze`, `renderQuestion` (KaTeX), `gradeAnswer`; tests in `tests/`.
- `scripts/build-index.ts` – scans `data/**/*.xml`, writes `site/public/index.json` (path, title, questions, modified, sha256 hash) and copies `data/` next to it.
- `site/` – Vite + vanilla TS app: one question at a time, free navigation (tree, jump bar, prev/next question/exercise, next unanswered, random, arrow keys), progress in `localStorage` with JSON export/import. Routes use hash URLs: `#/ex/<path>.xml/<question>`.
- `data/<studygraph-relative-path>.xml` – exercises, a plain folder tree. pyequa only copies each XML into the local clone of this repo (e.g. `data/mne/numcap5/sistema2x2.xml`); it does not run git. Review, then `git add data && git commit && git push` yourself. The current file is a sample.
- `data/index.yaml` (optional) – friendly names: a flat map of folder or file paths (relative to `data/`, `.xml` optional) to text, e.g. `numcap5: Numérica – Capítulo 5` or `numcap5/sistema2x2: Sistema 2x2`. Missing or incomplete entries fall back to the folder/file name.
- `.github/workflows/pages.yml` – on pushes touching `data/**` etc.: test, typecheck, build, deploy to GitHub Pages (enable Pages source "GitHub Actions" in repo settings).

## Commands
`npm install`, `npm test`, `npm run dev` (index + dev server), `npm run build`.


## create website from bash

```
git clone https://github.com/jpcaveiro/clozecloud
cd clozecloud
npm ci
npm run build:index
npm run build:site
```