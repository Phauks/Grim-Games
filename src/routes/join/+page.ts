import type { Chrome } from '#lib/features/shell/shell.ts';

// Player view fills the screen as the Storyteller's board does (Trevor, 2026-10-19): no
// sidebar; its own menu button opens the menu.
export const load = (): { chrome: Chrome } => ({ chrome: 'game' });
