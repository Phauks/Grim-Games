/**
 * The reducers for the Storyteller's changes to the night order and the day reminders, one for
 * each event type (`reducer.ts` looks them up).
 */
import { replaceAt, removeAt, type Reducers } from '#lib/core/engine/reduce/shared.ts';

function insertAt<T>(list: readonly T[], index: number, item: T): T[] {
	const copy = [...list];
	copy.splice(Math.max(0, Math.min(index, copy.length)), 0, item);
	return copy;
}

export const OVERRIDES_REDUCERS: Reducers<
	| 'NightStepOverrideAdded'
	| 'NightStepOverrideReplaced'
	| 'NightStepOverrideRemoved'
	| 'DayReminderOverrideAdded'
	| 'DayReminderOverrideReplaced'
	| 'DayReminderOverrideRemoved'
> = {
	NightStepOverrideAdded(game, event) {
		const nightOrderOverrides = insertAt(
			game.nightOrderOverrides,
			event.index,
			structuredClone(event.override)
		);
		return { ...game, nightOrderOverrides };
	},
	NightStepOverrideReplaced(game, event) {
		const nightOrderOverrides = replaceAt(
			game.nightOrderOverrides,
			event.index,
			structuredClone(event.override)
		);
		return nightOrderOverrides === game.nightOrderOverrides
			? game
			: { ...game, nightOrderOverrides };
	},
	NightStepOverrideRemoved(game, event) {
		const nightOrderOverrides = removeAt(game.nightOrderOverrides, event.index);
		return nightOrderOverrides === game.nightOrderOverrides
			? game
			: { ...game, nightOrderOverrides };
	},
	DayReminderOverrideAdded(game, event) {
		const dayReminderOverrides = insertAt(
			game.dayReminderOverrides,
			event.index,
			structuredClone(event.override)
		);
		return { ...game, dayReminderOverrides };
	},
	DayReminderOverrideReplaced(game, event) {
		const dayReminderOverrides = replaceAt(
			game.dayReminderOverrides,
			event.index,
			structuredClone(event.override)
		);
		return dayReminderOverrides === game.dayReminderOverrides
			? game
			: { ...game, dayReminderOverrides };
	},
	DayReminderOverrideRemoved(game, event) {
		const dayReminderOverrides = removeAt(game.dayReminderOverrides, event.index);
		return dayReminderOverrides === game.dayReminderOverrides
			? game
			: { ...game, dayReminderOverrides };
	}
};
