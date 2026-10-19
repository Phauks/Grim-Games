import type { Chrome } from '#lib/features/shell/shell.ts';

// The watched grimoire fills the screen as the Storyteller's board does.
export const load = (): { chrome: Chrome } => ({ chrome: 'game' });
