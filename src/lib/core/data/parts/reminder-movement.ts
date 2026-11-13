import { optObj, ownWords, STR, TOKENS } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * Which of a character's reminder tokens should stay on the seat they were first placed on
 * (Trevor, 2026-10-16: "token integrity"): the `reminderMovement` part of its rules block,
 * read here and used by `rules/reminders/reminder-movement.ts`.
 *
 * A token is FIXED when it records something decided once: setup or first-night information
 * ("start knowing"), a once-per-game effect, or the character's own spent ability. Moving a
 * fixed token to another player rewrites what happened, so the app asks first. A token is
 * MOVING when the ability places it again on a new choice (each night, each day, a counter,
 * a death marker for tonight), so moving it is routine. The Storyteller can still move any
 * token: a fixed token's move is a warning, never a refusal.
 *
 * - `fixed`: the labels that stay put; the character's other labels move;
 * - `why`: why the fixed labels stay put, or with no `fixed`, why all its tokens move;
 * - `relocates`: what this ability does that can legitimately carry a fixed token to another
 *   player, by changing or swapping who holds a character (a swapped Evil Twin takes "Twin"
 *   along). While it is in play, the warning names it.
 * - `followsNeighbours`: labels that mark the character's neighbours as its `reminderTargets`
 *   rule counts them (the Tea Lady's Cannot Die, the No Dashii's Poisoned). When players swap
 *   or move seats (the Matron), the app carries each one from a player who is no longer a
 *   neighbour to the new neighbour, because the ability follows the seating.
 *
 * `why` and `relocates` are our own summaries, never wiki prose.
 */
export const reminderMovement = specPart(
	'Reminders that stay',
	'Which of its reminder tokens stay where they were placed.',
	optObj({
		fixed: TOKENS,
		why: ownWords(STR),
		relocates: ownWords(STR),
		followsNeighbours: TOKENS
	}),
	(value, path, issues) => {
		const before = issues.list.length;
		value.followsNeighbours?.forEach((label, i) => {
			if (value.fixed?.includes(label)) {
				issues.add(`${path}.followsNeighbours[${i}]`, 'a fixed token cannot follow the neighbours');
			}
		});
		return issues.list.length > before ? undefined : value;
	}
);

export type ReminderMovementRules = PartValue<typeof reminderMovement>;
