# Grim-Games

A touch-first Storyteller grimoire for Blood on the Clocktower, written in TypeScript and Svelte 5 and hosted on Cloudflare Workers. It is a clean-room rewrite inspired by Pocket Grimoire; no Pocket Grimoire code is used.

Private project: not for public distribution until The Pandemonium Institute has granted permission.

## Stack

- SvelteKit 3 + Svelte 5 (runes) + TypeScript 6, built with `@sveltejs/adapter-static` as a client-rendered SPA.
- One Cloudflare Worker (`worker/index.ts`) serves the static build and the `/api/*` routes. Its SQLite Durable Objects are `Room` (live sync), `SharedScript` (share links), `AccountUser` and `AccountEmail` (accounts), `ReportBox` (in-app reports) and `ScriptMirror` (script sources, refreshed by a daily cron through `scheduled()`). Config: `wrangler.jsonc`.
- Vitest for unit and component tests; Playwright for touch e2e tests on an emulated phone and tablet against the real Worker under `wrangler dev`.

## Layout

```
src/lib/core/      pure TypeScript game rules (no Svelte, no DOM; enforced by ESLint)
src/lib/features/  Svelte feature modules (setup, grimoire, night, ...)
src/lib/ui/        touch primitives, theme tokens, fonts, icons, setting rows; Ark UI is only imported here
src/routes/        thin SvelteKit routes that compose features
worker/            Cloudflare Worker entry and Durable Objects
e2e/               Playwright tests (`*.e2e.ts`)
scripts/           Node scripts run as TypeScript (data sync)
static/data/       synced TPI data and icons (generated; see Data)
```

## Commands

| Command                                          | What it does                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                    | Vite dev server (no Worker)                                                                                                |
| `npm run preview`                                | Build, then run the app and shared data Workers locally with `wrangler dev` on port 8787                                   |
| `npm run check`                                  | svelte-check for the app, tsc for the Worker                                                                               |
| `npm run lint`                                   | Prettier + ESLint (including module-boundary rules) + hex-colour check + rules coverage                                    |
| `npm run icons`                                  | Regenerate the bundled icon modules after editing the icon catalogue                                                       |
| `npm run test:unit -- --run`                     | Vitest (node + browser projects)                                                                                           |
| `npm run test:e2e`                               | Playwright touch tests (phone + tablet)                                                                                    |
| `npm run verify`                                 | check + lint + unit tests; the pre-push hook in `.githooks` runs it (`npm install` turns the hook on)                      |
| `npm run sync:data`                              | Refresh TPI's data and icons in `static/data/` (see [Data](#data))                                                         |
| `npm run scaffold:rules-tests`                   | Create missing character and jinx test files (see [Rules tests](#rules-tests))                                             |
| `npm run check:rules-coverage`                   | Fail if a character or jinx has no test file; count scenario todos                                                         |
| `npm run export:setup-prep -- <file>`            | Write every character's setup preparation as JSON for review (from each rules file's `setupPrep`)                          |
| `npm run export:reminder-placeholders -- <file>` | Write what every `:reminder:` in TPI's night text means as JSON for review (from each rules file's `reminderPlaceholders`) |

If Chromium is already installed somewhere (for example a sandbox), set `PLAYWRIGHT_CHROMIUM_PATH` to its executable instead of running `npx playwright install`.

## Rules tests

Every character and every jinx has a test file, based on the [BotC wiki](https://wiki.bloodontheclocktower.com) (the rules authority):

- `src/lib/core/abilities/<characterId>.test.ts`: data checks generated from `roles.json` (type, default alignment, edition, setup, reminders, night sheet, `special`), then one `it.todo` per example in the wiki page's Examples section;
- `src/lib/core/jinxes/<a>__<b>.test.ts` (ids sorted): the jinx is in `jinxes.json` and applies only with both characters, then an `it.todo` for the rule it imposes.

To write a scenario, read the example on the wiki page and replace its `it.todo` with a test that sets up seats, characters and reminders, runs the action and checks the resulting state, prompts or warnings. Paraphrase it: the wiki has no licence, so never copy its prose. Keep the wiki URL at the top of the file. These files run in the `rules` Vitest project without per-file isolation (that keeps 300+ files fast), so don't use `vi.mock` or leave module state behind; read data with `#lib/core/testing/committed-data.ts`.

`npm run check:rules-coverage` (part of `npm run lint`, so CI runs it) fails when a character or jinx pair in `static/data/` has no test file, when a file doesn't cite its character's wiki URL, or when a file is left for a character or jinx that no longer exists. When a data sync adds one, run `npm run scaffold:rules-tests`: it only creates missing files, never overwrites. It also prints the number of `todo`s left, which the roadmap takes to zero for 1.0. `-- --fetch-examples` makes one numbered todo per wiki example (it counts them through the wiki's API and writes no wiki text).

## Deploying

Cloudflare [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) builds and deploys straight from this repository, so there is no deploy workflow or API token in GitHub:

- build command `if [ "$WORKERS_CI_BRANCH" = main ] || [ "$WORKERS_CI_BRANCH" = beta ]; then npm run build; else echo "Skipped: only main and beta build"; fi`, deploy command `npx wrangler deploy`: pushes to `main` deploy the `grim-games` Worker (production releases, merged from `beta`);
- all day-to-day work goes on the `beta` branch. The non-production deploy command is `if [ "$WORKERS_CI_BRANCH" = beta ]; then npx wrangler preview; else echo "Skipped: only beta gets a preview"; fi`, so only `beta` gets a Preview and other branches skip both build and deploy, since each Preview holds its own Durable Object namespaces and the account allows 500. `wrangler preview` creates a [Worker Preview](https://developers.cloudflare.com/workers/previews/) named after the branch on the same Worker, with its own URL and its own Durable Object storage. The `previews` block in `wrangler.jsonc` repeats the bindings and vars previews need.

GitHub Actions (`.github/workflows/ci.yml`) only runs checks and tests.

## Build info and issue reports

Every page footer shows the version, commit, branch, channel (`production`, `preview` or `local`) and build time, read at build time by `build-info.ts` from Workers Builds' `WORKERS_CI_*` variables (or git locally). **Report an issue** opens the GitHub bug-report form with the build, page and device prefilled. Issue forms live in `.github/ISSUE_TEMPLATE/`.

## Data

`static/data/` holds The Pandemonium Institute's toolmaker data, committed to the repo and served as static files:

- `roles.json`, `jinxes.json`, `nightsheet.json` (from `resources/data/` in botc-release) and `script-schema.json`, copied byte for byte;
- `icons/<edition>/` character icons: `<id>_g.webp` (good), `<id>_e.webp` (evil) and `<id>.webp` (unaligned: Travellers, Fabled, Loric);
- `logos/<edition>.webp` the base three editions' logos, from `resources/editions/<edition>/logo.webp`;
- `manifest.json`: the botc-release commit, fetch date, counts, and a SHA-256 for every file.

`npm run sync:data` refreshes it from a shallow git checkout of botc-release `main` (`-- --ref <sha>` pins a commit, `-- --source <dir>` uses a local checkout). It validates everything with the parsers in `src/lib/core/data` first and fails without writing if TPI's format has changed. With no upstream change it leaves no diff. The `Data sync` workflow runs it every Monday and opens or updates a pull request when something changed; `src/lib/core/data/tpi-data.test.ts` pins the expected counts, so update it after reviewing the change.

`night-order-provisional.json` is a one-off snapshot of numeric night positions from [Official-Data-Sync](https://github.com/Phauks/Blood-on-the-Clocktower---Official-Data-Sync) (`npm run snapshot:night-order`), marked provisional: TPI's `nightsheet.json` order is the source of truth and this file is to be replaced, not maintained. Its `_meta.disagreements` lists where it differs from TPI.

In code, load the files with `loadGameData` from `#lib/core/data/index.ts`; it maps TPI's `team` field to our character `type`.

## Data and acknowledgements

Character data, icons and edition logos come from The Pandemonium Institute's [botc-release](https://github.com/ThePandemoniumInstitute/botc-release) under its Community Created Content policy. Rules references link to the [official wiki](https://wiki.bloodontheclocktower.com), which is fetched live and never bundled.

Grim-Games is not affiliated with The Pandemonium Institute. Blood on the Clocktower is a trademark of Steven Medway and The Pandemonium Institute.
