# apps/web — preview only, not Milestone 6

This is **not** the real PRD §37-39 dashboard/report UI. It's a single
Next.js page added specifically so there's something to look at before the
Questionnaire (Milestone 2), Priority Engine (Milestone 5), and API
(Milestone 2/6) exist. It imports the Life Insurance calculator and the 5
test-fixture households directly and renders a recommendation-card-shaped
view of the result — no database, no auth, no API route, no persistence.

See docs/DECISIONS.md ("Life Insurance calculator slice + preview UI") for
exactly what this is and isn't.

## Run it

```bash
npm install          # from the repo root, once
npm run typecheck     # from the repo root — (re)builds packages/*/dist,
                       # which this app imports; rerun after editing any
                       # package under packages/
npm run preview        # from the repo root — starts `next dev` for this app
```

Then open http://localhost:3000.
