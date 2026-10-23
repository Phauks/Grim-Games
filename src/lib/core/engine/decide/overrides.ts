import {
	checkDuplicateAdd,
	dayOverride,
	nightOverride,
	overrideIndex,
	sameOverride,
	type Deciders
} from './shared.ts';

/** The Storyteller's own night steps and day reminders. */
export const OVERRIDES_DECIDERS: Deciders<
	| 'AddNightStepOverride'
	| 'ReplaceNightStepOverride'
	| 'RemoveNightStepOverride'
	| 'AddDayReminderOverride'
	| 'ReplaceDayReminderOverride'
	| 'RemoveDayReminderOverride'
> = {
	AddNightStepOverride(game, command, ctx, warn) {
		const list = game.nightOrderOverrides;
		const index = overrideIndex(command.index ?? list.length, list.length, true);
		const override = nightOverride(command.override, ctx);
		checkDuplicateAdd(list, override, warn);
		return [{ type: 'NightStepOverrideAdded', index, override }];
	},

	ReplaceNightStepOverride(game, command, ctx, warn) {
		const list = game.nightOrderOverrides;
		const index = overrideIndex(command.index, list.length, false);
		const override = nightOverride(command.override, ctx);
		checkDuplicateAdd(
			list.filter((_, i) => i !== index),
			override,
			warn
		);
		if (sameOverride(list[index], override)) {
			warn('no-change', 'the override is unchanged');
			return [];
		}
		return [{ type: 'NightStepOverrideReplaced', index, override }];
	},

	RemoveNightStepOverride(game, command) {
		const index = overrideIndex(command.index, game.nightOrderOverrides.length, false);
		return [{ type: 'NightStepOverrideRemoved', index }];
	},

	AddDayReminderOverride(game, command, ctx, warn) {
		const list = game.dayReminderOverrides;
		const index = overrideIndex(command.index ?? list.length, list.length, true);
		const override = dayOverride(game, command.override, ctx);
		checkDuplicateAdd(list, override, warn);
		return [{ type: 'DayReminderOverrideAdded', index, override }];
	},

	ReplaceDayReminderOverride(game, command, ctx, warn) {
		const list = game.dayReminderOverrides;
		const index = overrideIndex(command.index, list.length, false);
		const override = dayOverride(game, command.override, ctx);
		checkDuplicateAdd(
			list.filter((_, i) => i !== index),
			override,
			warn
		);
		if (sameOverride(list[index], override)) {
			warn('no-change', 'the override is unchanged');
			return [];
		}
		return [{ type: 'DayReminderOverrideReplaced', index, override }];
	},

	RemoveDayReminderOverride(game, command) {
		const index = overrideIndex(command.index, game.dayReminderOverrides.length, false);
		return [{ type: 'DayReminderOverrideRemoved', index }];
	}
};
