/**
 * When a reminder shows the thin line back to its seat (Trevor, 2026-10-29: "more controls
 * relating to when we show a line connecting a reminder to a player"), on the Storyteller's
 * board and on a player's Grim tab, each with its own choice:
 * - always: every reminder (the board before this choice);
 * - away: only a reminder pushed out past the first spot in front of its seat, where whose it
 *   is reads least clearly;
 * - held: only the reminders of a seat being held;
 * - never.
 * Pixels throughout.
 */
export const REMINDER_LINES = ['always', 'away', 'held', 'never'] as const;
export type ReminderLines = (typeof REMINDER_LINES)[number];

export const DEFAULT_REMINDER_LINES: ReminderLines = 'always';

/** A stored choice, or the default for anything else. */
export function parseReminderLines(raw: unknown): ReminderLines {
	return REMINDER_LINES.find((l) => l === raw) ?? DEFAULT_REMINDER_LINES;
}

/** The gap between a seat's token and its first reminder (reminder-fan.ts). */
const FIRST_GAP = 6;

export interface LineInput {
	/** The seat's centre and the reminder's centre. */
	seat: { x: number; y: number };
	at: { x: number; y: number };
	/** Token and reminder diameters. */
	size: number;
	chip: number;
	/** The seat is being held. */
	held: boolean;
}

/**
 * Whether a reminder sits away from its seat: further out than the first spot in front of
 * it (the token's rim, the fan's gap, then a reminder) by more than half a reminder.
 */
export function awayFromSeat(input: Omit<LineInput, 'held'>): boolean {
	const { seat, at, size, chip } = input;
	const distance = Math.hypot(at.x - seat.x, at.y - seat.y);
	const first = size / 2 + chip / 2 + FIRST_GAP;
	return distance > first + chip / 2;
}

/** Whether this reminder's line shows under `mode`. */
export function lineShown(mode: ReminderLines, input: LineInput): boolean {
	switch (mode) {
		case 'always':
			return true;
		case 'away':
			return awayFromSeat(input);
		case 'held':
			return input.held;
		case 'never':
			return false;
	}
}
