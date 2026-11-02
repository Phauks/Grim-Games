/**
 * Effects the Storyteller picks for a reminder whose rules let them (`pickedEffect`,
 * `data/parts/picked-effect.ts`): the Angel's Something Bad, a punishment the Storyteller
 * chooses for whoever is most responsible for a protected player's death
 * (https://wiki.bloodontheclocktower.com/Angel). The one the rules know is `no-kill`: its player
 * kills no one on the night after it is picked, shown at their step (`night-alerts.ts`). Any
 * other punishment is the Storyteller's own words on the token.
 */
import {
	REMINDER_EFFECTS,
	type PickedEffect,
	type ReminderEffectKind
} from '#lib/core/data/parts/picked-effect.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, Reminder, ReminderEffect } from '#lib/core/model/types.ts';

export { REMINDER_EFFECTS, type PickedEffect, type ReminderEffectKind };

/** The effects this reminder may carry, when its character's rules let the Storyteller pick. */
export function pickedEffectOf(
	reminder: Reminder,
	characters?: CharacterLookup
): PickedEffect | undefined {
	const rule = rulesOf(reminder.characterId, characters)?.pickedEffect;
	return rule && rule.token.toLowerCase() === reminder.label.toLowerCase() ? rule : undefined;
}

/**
 * The night an effect picked now acts on, numbered as the day view numbers nights
 * (`game-phase.ts`): the next night, so the one after tonight while a night is under way (the Angel's example: the Demon kills a protected player, and cannot
 * attack on the next night).
 */
export function effectNight(game: Game, nightUnderway: boolean): number {
	return game.pastDays.length + (nightUnderway ? 2 : 1);
}

/** Whether `effect` is a `no-kill` acting on the night in progress (`game.pastDays` + 1). */
export function stopsKillingTonight(effect: ReminderEffect | undefined, game: Game): boolean {
	return effect?.kind === 'no-kill' && effect.night === game.pastDays.length + 1;
}
