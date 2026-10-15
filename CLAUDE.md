# Working on Grim-Games

- Read `README.md` for the stack, layout and commands.
- `src/lib/core` is pure TypeScript: no Svelte, SvelteKit, DOM or UI imports (ESLint enforces it). Game logic goes there with Vitest tests.
- Features never import `@ark-ui/*`; they use our wrappers in `src/lib/ui/primitives`.
- Use the game's own terminology (character type vs alignment, seat, reminder, Fabled/Loric as rule characters). Don't invent terms.
- The BotC wiki is the rules authority. Tests for characters and jinxes cite the wiki page they encode; paraphrase, never copy wiki prose (it has no licence).
- Clean-room rewrite: never copy code from Pocket Grimoire (GPL-3.0) or other GPL projects.
- Touch first: tap targets of at least 44px, Pointer Events, and every new flow gets a Playwright test on the phone and tablet projects.
- Imports inside `src` use `#lib/...` with the `.ts` extension for TypeScript files.
- Before pushing: `npm run check && npm run lint && npm run test:unit -- --run && npm run test:e2e`.
- Worker logs keep query strings (`redact_query_string: false` in wrangler.jsonc). Never put private game state, room secrets or scripts in a query string; use the path or the URL hash (the hash never reaches the server).
- All work goes on the `beta` branch (Trevor, 2026-10-15); it deploys as the `beta` Worker Preview. `main` is production and only receives releases from `beta`.
- The app is an offline-first PWA (`src/service-worker.ts`): each build is precached and only replaces the old one when the user taps Refresh. Saved game state must therefore be versioned with migrations, because a newer build can open a game saved by an older one.
