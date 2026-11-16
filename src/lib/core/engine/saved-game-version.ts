/**
 * The format of every saved game (persistence.ts). On its own so the service worker can tell
 * an open page which format its build reads (update-check.svelte.ts) without the rest of the
 * engine.
 *
 * To change the saved shape (including any event shape in `events.ts`): bump it. Games saved
 * in the old shape then stop opening; there are no migrations (Trevor, 2026-11-10).
 */
export const SAVED_GAME_VERSION = 32;
