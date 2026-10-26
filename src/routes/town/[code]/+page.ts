import type { Chrome } from '#lib/features/shell/shell.ts';

// The table's display is the town alone, so the sidebar gives way to the page's own menu
// button, as on a game screen.
export const load = (): { chrome: Chrome } => ({ chrome: 'game' });
