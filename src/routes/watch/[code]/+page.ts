import type { Chrome } from '#lib/features/shell/shell.ts';

// A spectator isn't running the game, so the app's sidebar stays, and they can leave and come
// back (Trevor, 2026-10-25). The board's own hamburger gives way to it while it shows.
export const load = (): { chrome: Chrome } => ({ chrome: 'app' });
