import type { Chrome } from '#lib/features/shell/shell.ts';

// A game in progress hides the app header and footer, so a stray tap can't leave it; the
// board's ☰ menu has Settings, Account and Exit game instead (Trevor, 2026-10-16).
export const load = (): { chrome: Chrome } => ({ chrome: 'game' });
