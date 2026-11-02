import { enumPart } from './part.ts';

/**
 * What a player says in town that the day log keeps for their ability (Trevor, 2026-10-23:
 * L56, "these all relate to specific announcements in town by players"): seat and character
 * guesses, one statement that is true or false, two statements, or a private guess at their
 * own ability the Storyteller answers Cold, Warm, Hot or Bingo (the Amnesiac,
 * https://wiki.bloodontheclocktower.com/Amnesiac).
 */
const DAY_CLAIMS = ['guesses', 'statement', 'statements', 'ability-guess'] as const;
export type DayClaim = (typeof DAY_CLAIMS)[number];

/** The claim its player makes by day, logged from their day row and seat ⋯ menu (L56). */
export const dayClaim = enumPart(
	'Day claim',
	'The claim its player makes by day, logged from their day row and seat menu.',
	DAY_CLAIMS
);
