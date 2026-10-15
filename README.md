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

If Chromium is already installed somewhere (for example a sandbox), set `PLAYWRIGHT_CHROMIUM_PATH` to its executable instead of running `npx playwright install`.

## Deploying

Cloudflare [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) builds and deploys straight from this repository, so there is no deploy workflow or API token in GitHub:

- build command `npm run build`, deploy command `npx wrangler deploy`: pushes to `main` deploy the `grim-games` Worker;
- other branches and pull requests run `npx wrangler preview`, which creates a [Worker Preview](https://developers.cloudflare.com/workers/previews/) on the same Worker, with its own URL and its own Durable Object storage. The `previews` block in `wrangler.jsonc` repeats the bindings and vars previews need.

GitHub Actions (`.github/workflows/ci.yml`) only runs checks and tests.

## Build info and issue reports

Every page footer shows the version, commit, branch, channel (`production`, `preview` or `local`) and build time, read at build time by `build-info.ts` from Workers Builds' `WORKERS_CI_*` variables (or git locally). **Report an issue** opens the GitHub bug-report form with the build, page and device prefilled. Issue forms live in `.github/ISSUE_TEMPLATE/`.

## Data and acknowledgements

Character data and icons come from The Pandemonium Institute's [botc-release](https://github.com/ThePandemoniumInstitute/botc-release) under its Community Created Content policy. Rules references link to the [official wiki](https://wiki.bloodontheclocktower.com), which is fetched live and never bundled.

Grim-Games is not affiliated with The Pandemonium Institute. Blood on the Clocktower is a trademark of Steven Medway and The Pandemonium Institute.
