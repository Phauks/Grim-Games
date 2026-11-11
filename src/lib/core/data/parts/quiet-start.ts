import { COUNT, obj, oneOf } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

const QUIET_PLAYERS = ['veterans'] as const;
export type QuietPlayers = (typeof QUIET_PLAYERS)[number];

/**
 * While the character is in play, some players may not talk for the first part of each day
 * (`rules/day/quiet-start.ts`; counted down on the day timer by `features/day/DayTimer.svelte`).
 */
export const quietStart = specPart(
	'Quiet start',
	'While in play, some players may not talk for the first part of each day.',
	// `seconds`: how long the quiet lasts from the start of each day; `players`: who stays
	// quiet (the players the Storyteller picked as veterans).
	obj({ seconds: COUNT, players: oneOf(QUIET_PLAYERS) })
);

export type QuietStart = PartValue<typeof quietStart>;
