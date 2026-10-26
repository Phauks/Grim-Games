/**
 * Where a game is up to: Setup, a night or a day, numbered as the day view numbers its days
 * (Trevor, 2026-10-24: the board, Game info, Resume and the day view must agree). Day N
 * follows Night N, so `days` (the days begun, `game.pastDays.length`) is today's number.
 * Pure: callers say whether the first night has begun and whether a night is under way,
 * which only the device knows.
 */
export type GamePhase = { kind: 'setup' } | { kind: 'night' | 'day'; number: number };

export function gamePhase(
	days: number,
	{ begun, nightUnderway }: { begun: boolean; nightUnderway: boolean }
): GamePhase {
	if (nightUnderway) return { kind: 'night', number: days + 1 };
	if (days === 0) return begun ? { kind: 'night', number: 1 } : { kind: 'setup' };
	return { kind: 'day', number: days };
}

/**
 * Where the game is up to, as players' phones show it (Trevor, 2026-10-26: "During Town
 * Phase, it says Town, during night it says night, and during day ... that general time").
 * A day is Town from the Storyteller's Back to town call until the day ends.
 */
export type PlayersPhase = { kind: 'setup' } | { kind: 'night' | 'day' | 'town'; number: number };

const PLAYERS_PHASES = ['setup', 'night', 'day', 'town'] as const;

/** A players' phase from the room, or nothing when it isn't one. */
export function parsePlayersPhase(value: unknown): PlayersPhase | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const { kind, number } = value as { kind?: unknown; number?: unknown };
	if (!PLAYERS_PHASES.includes(kind as PlayersPhase['kind'])) return undefined;
	if (kind === 'setup') return { kind };
	if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return undefined;
	return { kind: kind as 'night' | 'day' | 'town', number };
}
