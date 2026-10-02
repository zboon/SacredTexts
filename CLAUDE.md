# Sacred Texts: notes for Claude

Static offline PWA. Everything is in `index.html` (content, CSS, JS, embedded fonts).
`sw.js` is the service worker. No build, no backend. Read `README.md` and
`CONTRIBUTING.md` before changing anything.

## Rules that always apply

- `index.html` is ~2.8MB. Grep for the array or function you need. Don't read it whole.
- A PR into `main` that changes the app bumps `sw.js` `CACHE`, `APP_VERSION` and `<meta name="app-version">` together. Section-branch PRs don't bump.
- Run the static check in `.claude/skills/CONVENTIONS.md` §7.1 before every push. One JS syntax error blanks the whole app.
- Never modify the KFGQPC Uthmani font bytes, never rename `mawlid-*` storage keys without a migration, never add copyrighted text.

## Playbooks

Standard processes live in `.claude/skills/` (index: `.claude/skills/README.md`):
`issue-assistant`, `dev-issue`, `pr-review`, `test-issue`, `regression-pack`.
Follow the matching playbook whenever a task fits one.
