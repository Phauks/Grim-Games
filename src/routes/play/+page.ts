import type { Chrome } from '#lib/features/shell/shell.ts';

// Player view shows the app's sidebar, so its menu button sits where every page's does
// (Trevor, 2026-10-23).
export const load = (): { chrome: Chrome } => ({ chrome: 'app' });
