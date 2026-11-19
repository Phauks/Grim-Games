/**
 * A seat's reminders as the board stacks them (Trevor, 2026-11-19: "Courtier drunk tokens
 * aren't stacking on grim? Shouldn't they do that and others?", look A: the top token with a
 * ×N count). On one seat, the tokens of one run (`counter` or `countdown` in the character's
 * rules: the Summoner's Night 1, 2 and 3, the Courtier's Drunk 1, 2 and 3) are one stack, the
 * latest of the run on top, as the bank stacks them (`bundledCounters`); with `stackSame`
 * ("Stack duplicate reminders"), so are the same character's same reminder twice on one seat
 * (two of the Mathematician's Abnormal). Generic tokens each look their own and never stack.
 * The Storyteller's board (BoardSeats) and a player's grim (PlayerSeatReminders) alike.
 */
import type { CharacterId, ReminderLabel } from '#lib/core/data/index.ts';
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import { GENERIC_REMINDER_ID, type SeatId } from '#lib/core/model/index.ts';

/** What stacking reads of a reminder. */
export interface Stackable {
	characterId: CharacterId;
	label: ReminderLabel;
	ownerSeatId?: SeatId;
}

/** A character's rules, by id: the game's characters, or a player's grim's. */
export type RulesById = (id: CharacterId) => { rules?: CharacterRules } | undefined;

/** The run a reminder belongs to, in order, if any. */
function runOf(reminder: Stackable, characterOf: RulesById): readonly ReminderLabel[] | undefined {
	const rules = characterOf(reminder.characterId)?.rules;
	const tokens = rules?.counter?.tokens ?? rules?.countdown?.tokens;
	return tokens?.includes(reminder.label) ? tokens : undefined;
}

/** A seat's reminders as stacks, in the order the first of each was placed; each stack's top last. */
export function reminderStacks<R extends Stackable>(
	reminders: readonly R[],
	characterOf: RulesById,
	stackSame: boolean
): R[][] {
	const stacks: R[][] = [];
	const byKey = new Map<string, R[]>();
	for (const reminder of reminders) {
		const generic = reminder.characterId === GENERIC_REMINDER_ID;
		const run = generic ? undefined : runOf(reminder, characterOf);
		// Identity keys, never shown.
		const of = [reminder.characterId, reminder.ownerSeatId ?? ''].join(':');
		const key = run
			? ['run', of].join(':')
			: stackSame && !generic
				? ['same', of, reminder.label].join(':')
				: undefined;
		const stack = key === undefined ? undefined : byKey.get(key);
		if (stack) stack.push(reminder);
		else {
			const fresh = [reminder];
			stacks.push(fresh);
			if (key !== undefined) byKey.set(key, fresh);
		}
	}
	for (const stack of stacks) {
		const run = runOf(stack[0], characterOf);
		// The run's latest token on top; the same reminder's last placed already is.
		if (run && stack.length > 1) stack.sort((a, b) => run.indexOf(a.label) - run.indexOf(b.label));
	}
	return stacks;
}
