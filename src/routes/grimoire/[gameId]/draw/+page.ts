import type { Chrome } from '#lib/features/shell/shell.ts';

// Character setup is part of the game: like the board, no app sidebar or header (Trevor,
// 2026-10-23). Its bottom bar's Back is the way out.
export const load = (): { chrome: Chrome } => ({ chrome: 'game' });
