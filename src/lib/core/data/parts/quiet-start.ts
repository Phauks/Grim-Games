import { checkKeys, describe, isObject, readEnum, readNumber, type Issues } from '../validate.ts';
import { objectPart } from './part.ts';

const QUIET_PLAYERS = ['veterans'] as const;
export type QuietPlayers = (typeof QUIET_PLAYERS)[number];

export interface QuietStart {
	/** How long the quiet lasts from the start of each day, in seconds. */
	seconds: number;
	/** Who stays quiet: the players the Storyteller picked as veterans. */
	players: QuietPlayers;
}

function readQuietStart(raw: unknown, path: string, issues: Issues): QuietStart | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['seconds', 'players'], path, issues);
	const seconds = readNumber(raw, 'seconds', path, issues);
	const players = readEnum(raw, 'players', QUIET_PLAYERS, path, issues, true);
	if (seconds === undefined || seconds <= 0) {
		issues.add(`${path}.seconds`, 'expected a number of seconds above 0');
		return undefined;
	}
	if (!players) return undefined;
	return { seconds, players };
}

/**
 * While the character is in play, some players may not talk for the first part of each day
 * (`rules/quiet-start.ts`; counted down on the day timer by `features/day/DayTimer.svelte`).
 */
export const quietStart = objectPart(
	'Quiet start',
	'While in play, some players may not talk for the first part of each day.',
	readQuietStart
);
