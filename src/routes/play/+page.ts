import type { Chrome } from '#lib/features/shell/shell.ts';

// The player view keeps the app's sidebar, as Join game does (Trevor, 2026-10-24: its menu
// looked different). Leaving a loaded script still asks first (PlayerView's LeaveGuard).
export const load = (): { chrome: Chrome } => ({ chrome: 'app' });
