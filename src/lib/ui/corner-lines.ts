/**
 * Which of Game info's lines the board's lower left corner shows (Trevor, 2026-10-24: "an eye
 * toggle on each line in game info, and that is how it is decided what will populate in the
 * bottom left"). The keys are Game info's rows; the script's name has no eye, since it is the
 * corner's way into Game info. Replaces the Board settings for the join code, Game time and
 * the day or night, whose saved choices carry over. The day or night and Game time are lines
 * of their own, each with its own eye (Trevor, 2026-10-26).
 */
export const CORNER_LINES = [
	'author',
	'version',
	'storyteller',
	'players',
	'mode',
	'rules',
	'join-code',
	'phase',
	'game-time',
	'watchers'
] as const;
export type CornerLine = (typeof CORNER_LINES)[number];
export type CornerLines = Record<CornerLine, boolean>;

/** The corner as it was before the eyes: everything it showed then, and nothing new. */
export const DEFAULT_CORNER_LINES: CornerLines = Object.fromEntries(
	CORNER_LINES.map((line) => [line, line !== 'version' && line !== 'players'])
) as CornerLines;

const flag = (value: unknown) => (typeof value === 'boolean' ? value : undefined);

/**
 * Saved eyes, with any missing taking their default. Preferences saved before the eyes carry
 * their join code switch to the join code, and their Game time and day-or-night switches to
 * those lines. Eyes saved while Game time also showed the day or night give the day or night
 * Game time's eye.
 */
export function parseCornerLines(raw: unknown, oldAssistance?: unknown): CornerLines {
	const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const out: CornerLines = { ...DEFAULT_CORNER_LINES };
	if (!raw && oldAssistance && typeof oldAssistance === 'object') {
		const old = oldAssistance as Record<string, unknown>;
		out['join-code'] = flag(old.roomCode) ?? out['join-code'];
		const clock = flag(old.gameClock);
		const phase = flag(old.boardPhase);
		out['game-time'] = clock ?? out['game-time'];
		out.phase = phase ?? out.phase;
	}
	for (const line of CORNER_LINES) {
		const value = flag(input[line]);
		if (value !== undefined) out[line] = value;
	}
	if (flag(input.phase) === undefined && flag(input['game-time']) !== undefined)
		out.phase = !!input['game-time'];
	return out;
}
