import type { Chrome } from '#lib/features/shell/shell.ts';

// Watching, not running the game, so the app's sidebar stays, as on /watch.
export const load = (): { chrome: Chrome } => ({ chrome: 'app' });
