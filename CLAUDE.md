# Working in this repo

Read these before doing anything non-trivial — they're maintained, not stale:

- `README.md` — what's built, layout, getting started, deployment.
- `docs/DECISIONS.md` — dated architecture/decision log, newest first. Read
  this before assuming something is a bug — it's very likely already a
  documented, deliberate tradeoff.
- `docs/ASSUMPTIONS.md` — every invented/placeholder number and why.
- `docs/REGULATORY-TODO.md` — what's explicitly not production-ready yet.
- `INSURANCE_ADVISOR_PRD_v1.0.md` — the source spec (61 sections, cited
  throughout the code/docs as `§N`).

## Non-obvious operational facts

- **Two `.env` files, not one**: root `.env` is for the `prisma` CLI
  (`migrate`/`generate`, run from repo root). `apps/web/.env` is the one
  Next.js actually reads (its own project root) — a var missing there
  silently breaks at build time (`NEXT_PUBLIC_*`) or runtime, with no error
  pointing at the cause. See docs/DECISIONS.md's 2026-09-12 entry for the
  exact bug this caused (Google Sign-In button rendering nothing). Keep
  both files' values in sync when adding a new env var.
- **UI is Hebrew-only, RTL.** Every user-facing string is Hebrew; no PRD
  section numbers or internal identifiers in end-user text (checked for
  and fixed multiple times — see docs/DECISIONS.md). Decorative navigation
  arrows in RTL links use `→`, not `←`, by established convention
  regardless of whether the action itself is "back" or "forward"
  semantically.
- **Deployment**: standalone PM2 process (`insurance-advisor-platform`)
  terminating its own HTTPS on port 37000 — not IIS, not a reverse proxy.
  See README's "Deployment" section and docs/DECISIONS.md's 2026-09-11
  entry for why. To redeploy after a code change:
  ```bash
  npm run build --workspace apps/web
  pm2 restart insurance-advisor-platform --update-env
  pm2 save
  ```
  If the change touches `prisma/schema.prisma`, stop the process first
  (`pm2 stop insurance-advisor-platform`) before running a migration —
  Windows will EPERM on the query-engine `.dll` while it's in use by a
  running process.
- **Auth is hand-rolled** (`apps/web/lib/auth.ts`), not NextAuth — DB-backed
  revocable sessions via a cookie, not a signed JWT. Every data API route
  must check `getCurrentUser` + `clientProfileBelongsToUser` — a
  `clientProfileId` is always client-supplied and never trustworthy on its
  own.
- **The LLM explanation layer (`/api/explain`, PRD §29)** must never widen
  beyond "explain a number that's already been computed." Read
  `apps/web/lib/llm-explain.ts`'s header comment before touching it — the
  boundary (what it's allowed/forbidden to do, what data it may see) is
  deliberate, not incidental.

## Before calling anything done

Run, in this order, and don't report success until all pass:

```bash
npm run typecheck   # tsc -b, strict mode, no `any`
npm run lint         # eslint .
npm test             # vitest run — 146+ tests
npm run build --workspace apps/web   # catches type errors typecheck alone doesn't (see docs/DECISIONS.md)
```

**This build command writes to the exact same `apps/web/.next` the live PM2
process serves from — there is no separate build output for "just
checking".** Running it while `insurance-advisor-platform` is up (which it
normally is) immediately invalidates the running process's chunk
references, even if you never intended to deploy: the browser still has
the old page's HTML (old chunk hashes) loaded, the new build's `.next`
folder has different hashes and has deleted the old chunk files, and the
next lazy-loaded chunk fetch 400s → `ChunkLoadError` for any real user with
the site open, not just a next reload. This actually happened, live, in
production — see docs/DECISIONS.md's 2026-09-12 "live site broke" entry.
**If this checklist's build step runs against this repo and
`insurance-advisor-platform` is currently online, immediately follow with
`pm2 restart insurance-advisor-platform --update-env && pm2 save`**
regardless of whether you consider this a "real deploy" — running the
build at all is what breaks the live site, restarting is what fixes it,
and there's no reason not to since the new build is presumably what you
want live anyway (if it weren't, the fix is `git stash`/checkout + rebuild
+ restart again, not leaving the mismatch in place).

For anything touching a live user-facing flow (auth, a new page, a button),
verify against the actual running app — `curl`/Playwright against
`https://localhost:37000` (production, via PM2) or `npm run preview`
(`http://localhost:4310`, dev) — not just unit tests. Several real bugs in
this project's history (an env var that silently no-op'd, a button that
rendered nothing) passed typecheck/lint/tests cleanly and were only caught
by actually loading the page.

## Working style this project has used so far

- Terse user feedback (a screenshot, a phrase, a "?") — diagnose fully
  before responding, don't ask for restatement unless genuinely ambiguous.
- Every fix/feature gets a dated entry in `docs/DECISIONS.md` (and
  `docs/ASSUMPTIONS.md` if it invents a number/placeholder), not just a
  commit message — the docs are the record a future session reads first.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5
  <noreply@anthropic.com>`; push to `origin master` at
  `https://github.com/LiorShilman/InsuranceAdvisorPlatform.git`.
- Respond to the user in Hebrew.
