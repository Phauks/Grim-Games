import type { Chrome } from '#lib/features/shell/shell.ts';

// The player screen's Grim, so the app's sidebar stays, as on /play (Trevor, 2026-10-26).
export const load = (): { chrome: Chrome } => ({ chrome: 'app' });
