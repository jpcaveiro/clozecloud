# clozecloud

Static site and TypeScript library to study Moodle Cloze exercises exported from pyequa.

## Layout
- `packages/clozelib` – `parseQuiz`, `parseCloze`, `renderQuestion` (KaTeX), `gradeAnswer`; tests in `tests/`.
- `scripts/build-index.ts` – scans `data/<tag>/**/*.xml`, writes `site/public/index.json` (tag, path, title, questions, modified, sha256 hash) and copies `data/` next to it.
- `site/` – Vite + vanilla TS app: one question at a time, free navigation (tree, jump bar, prev/next question/exercise, next unanswered, random, arrow keys), progress in `localStorage` with JSON export/import. Routes use hash URLs: `#/ex/<tag>/<path>.xml/<question>`.
- `data/<tag>/<studygraph-relative-path>.xml` – exercises pushed by the pyequa hook (`data/demo` is a sample).
- `.github/workflows/pages.yml` – on pushes touching `data/**` etc.: test, typecheck, build, deploy to GitHub Pages (enable Pages source "GitHub Actions" in repo settings).

## Commands
`npm install`, `npm test`, `npm run dev` (index + dev server), `npm run build`.
