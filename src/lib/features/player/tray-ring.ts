import { sharedSeats, type SeatLayout, type SeatPoint } from '#lib/ui/seating/seat-layout.ts';
import { reminderChip } from './player-reminders.ts';

/** The tray's height over its tokens, as the board's bank (GrimoireBoard `--tray-h`), in px. */
export const TRAY_EXTRA = 30;
/** Its gaps above and below inside the town, in px. */
const TRAY_GAPS = 16;

/**
 * A player's ring of seats above the reminder tray docked at the town's foot (Trevor,
 * 2026-10-31: the Storyteller's bank's own tray), as the board's ring keeps clear of its bank;
 * a Public Town display has no tray (`tray` false). `ring` is the town above the tray, and
 * `ringPoints` the seats in % of it; `points` are the same seats in % of the whole town.
 */
export function ringAboveTray(
	{
		seats,
		layout,
		board,
		aspect,
		fit,
		tools,
		tray
	}: {
		seats: readonly { seatId: string }[];
		layout: SeatLayout;
		board: { width: number; height: number };
		aspect: number | undefined;
		fit: boolean;
		tools: { w: number; h: number } | undefined;
		tray: boolean;
	},
	preferences: { tokenAppearance: { tokenScale: number; reminderScale: number } }
) {
	const scale = preferences.tokenAppearance.reminderScale;
	const chip = reminderChip(
		sharedSeats(seats, layout, board, aspect, fit, preferences).size,
		scale
	);
	const trayH = chip + TRAY_EXTRA;
	const foot = tray ? trayH + TRAY_GAPS : 0;
	const ring = { width: board.width, height: Math.max(0, board.height - foot) };
	const { size, points: ringPoints } = sharedSeats(
		seats,
		layout,
		ring,
		aspect,
		fit,
		preferences,
		tools
	);
	const points: SeatPoint[] =
		board.height > 0 && foot > 0
			? ringPoints.map((p) => ({ ...p, y: (p.y * ring.height) / board.height }))
			: ringPoints;
	return { chip, trayH, foot, ring, ringPoints, size, points };
}
