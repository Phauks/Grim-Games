import type { Chrome } from '#lib/features/shell/shell.ts';

// Join game keeps the app's sidebar, as every other page does (Trevor, 2026-10-24: it looked
// like a different menu). Leaving a loaded script still asks first (PlayerView's LeaveGuard).
export const load = (): { chrome: Chrome } => ({ chrome: 'app' });
