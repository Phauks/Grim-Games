# Grim-Games

A touch-first Storyteller grimoire for Blood on the Clocktower, written in TypeScript and Svelte 5 and hosted on Cloudflare Workers. It is a clean-room rewrite inspired by Pocket Grimoire; no Pocket Grimoire code is used.

Private project: not for public distribution until The Pandemonium Institute has granted permission.

## Stack

- SvelteKit 3 + Svelte 5 (runes) + TypeScript 6, built with `@sveltejs/adapter-static` as a client-rendered SPA.
- One Cloudflare Worker (`worker/index.ts`) serves the static build, the `/api/*` routes and the `Room` Durable Object used for live sync. Config: `wrangler.jsonc`.
- Vitest for unit and component tests; Playwright for touch e2e tests on an emulated phone and tablet against the real Worker under `wrangler dev`.

## Layout

```
src/lib/core/      pure TypeScript game rules (no Svelte, no DOM; enforced by ESLint)
src/lib/features/  Svelte feature modules (setup, grimoire, night, ...)
src/lib/ui/        touch primitives, theme tokens, icons; Ark UI is only imported here
src/routes/        thin SvelteKit routes that compose features
worker/            Cloudflare Worker entry and Durable Objects
e2e/               Playwright tests (`*.e2e.ts`)
scripts/           Node scripts run as TypeScript (data sync)
static/data/       synced TPI data and icons (generated; see Data)
```

## Commands

| Command                      | What it does                                                             |
| ---------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                | Vite dev server (no Worker)                                              |
| `npm run preview`            | Build, then run the full Worker locally with `wrangler dev` on port 8787 |
| `npm run check`              | svelte-check for the app, tsc for the Worker                             |
| `npm run lint`               | Prettier + ESLint (including module-boundary rules)                      |
| `npm run test:unit -- --run` | Vitest (node + browser projects)                                         |
| `npm run test:e2e`           | Playwright touch tests (phone + tablet)                                  |
| `npm run sync:data`          | Refresh TPI's data and icons in `static/data/` (see [Data](#data))       |

If Chromium is already installed somewhere (for example a sandbox), set `PLAYWRIGHT_CHROMIUM_PATH` to its executable instead of running `npx playwright install`.

## Deploying

GitHub Actions deploys with `cloudflare/wrangler-action`:

- push to `main` deploys the `grim-games` Worker (production);
- every pull request deploys the shared `grim-games-staging` Worker. Cloudflare does not create per-branch preview URLs for Workers that implement a Durable Object, so staging is one shared Worker.

The workflow needs two repository secrets, `CLOUDFLARE_API_TOKEN` (an account token with the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`. Without them the deploy job is skipped.

## Data

`static/data/` holds The Pandemonium Institute's toolmaker data, committed to the repo and served as static files:

- `roles.json`, `jinxes.json`, `nightsheet.json` (from `resources/data/` in botc-release) and `script-schema.json`, copied byte for byte;
- `icons/<edition>/` character icons: `<id>_g.webp` (good), `<id>_e.webp` (evil) and `<id>.webp` (unaligned: Travellers, Fabled, Loric);
- `manifest.json`: the botc-release commit, fetch date, counts, and a SHA-256 for every file.

`npm run sync:data` refreshes it from a shallow git checkout of botc-release `main` (`-- --ref <sha>` pins a commit, `-- --source <dir>` uses a local checkout). It validates everything with the parsers in `src/lib/core/data` first and fails without writing if TPI's format has changed. With no upstream change it leaves no diff. The `Data sync` workflow runs it every Monday and opens or updates a pull request when something changed; `src/lib/core/data/tpi-data.test.ts` pins the expected counts, so update it after reviewing the change.

`night-order-provisional.json` is a one-off snapshot of numeric night positions from [Official-Data-Sync](https://github.com/Phauks/Blood-on-the-Clocktower---Official-Data-Sync) (`npm run snapshot:night-order`), marked provisional: TPI's `nightsheet.json` order is the source of truth and this file is to be replaced, not maintained. Its `_meta.disagreements` lists where it differs from TPI.

In code, load the files with `loadGameData` from `#lib/core/data/index.ts`; it maps TPI's `team` field to our character `type`.

## Data and acknowledgements

Character data and icons come from The Pandemonium Institute's [botc-release](https://github.com/ThePandemoniumInstitute/botc-release) under its Community Created Content policy. Rules references link to the [official wiki](https://wiki.bloodontheclocktower.com), which is fetched live and never bundled.

Grim-Games is not affiliated with The Pandemonium Institute. Blood on the Clocktower is a trademark of Steven Medway and The Pandemonium Institute.
