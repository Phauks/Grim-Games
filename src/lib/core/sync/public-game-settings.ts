import { DAY_SECONDS_PER_ALIVE_MAX, DAY_SECONDS_PER_ALIVE_MIN } from '#lib/core/rules/day-timer.ts';

/**
 * The game's settings that change how it runs for the table (Trevor, 2026-10-30: "setup on
 * players phones should show the different options in the game setting menu so users
 * understand"): what a phone shows, read only, so players know how the game will run. Only
 * what players meet; the Setup look on phones they see for themselves. Each is left out when
 * the board sends nothing readable for it.
 */
export interface PublicGameSettings {
	/** The Storyteller records who nominated whom each day. */
	trackNominations?: boolean;
	/** The day timer's starting seconds per living player. */
	timerPerPlayer?: number;
	/** The bag draw asks a player's name before they see their character. */
	requireName?: boolean;
	/** The drawn character shows only while held. */
	holdToReveal?: boolean;
	/** The drawn character spins through the script first. */
	slotMachine?: boolean;
}

const SWITCHES = ['trackNominations', 'requireName', 'holdToReveal', 'slotMachine'] as const;

/** Settings from another device, field by field: anything malformed is left out. */
export function parsePublicGameSettings(raw: unknown): PublicGameSettings | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const r = raw as Record<string, unknown>;
	const out: PublicGameSettings = {};
	for (const key of SWITCHES) if (typeof r[key] === 'boolean') out[key] = r[key];
	const seconds = r.timerPerPlayer;
	if (
		typeof seconds === 'number' &&
		Number.isInteger(seconds) &&
		seconds >= DAY_SECONDS_PER_ALIVE_MIN &&
		seconds <= DAY_SECONDS_PER_ALIVE_MAX
	)
		out.timerPerPlayer = seconds;
	return Object.keys(out).length ? out : undefined;
}
