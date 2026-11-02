/**
 * Effects the Storyteller picks for a reminder whose rules let them (`pickedEffect`,
 * `data/parts/picked-effect.ts`): the Angel's Something Bad, a punishment the Storyteller
 * chooses for whoever is most responsible for a protected player's death
 * (https://wiki.bloodontheclocktower.com/Angel). What each one the rules know does:
 * - `no-kill`: its player kills no one on the night after it is picked, shown at their step
 *   (`night-alerts.ts`);
 * - `poisoned`: its player's ability is poisoned while it is marked (`ability.ts`);
 * - `no-ability-today`: its player has no ability for a day, until the next New day (`ability.ts`);
 * - `mad`, `no-vote-today`: a day reminder line for its player (`day-reminders.ts`); nothing in the
 *   app tracks who may vote, so the Storyteller holds the vote back;
 * - `dies`: a day reminder line while its player lives, and Mark dead in its reminder dialog.
 * Any other punishment is the Storyteller's own words on the token.
 */
import {
	REMINDER_EFFECTS,
	type PickedEffect,
	type ReminderEffectKind
} from '#lib/core/data/parts/picked-effect.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { ImpairmentReason } from '#lib/core/data/character-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { Game, Reminder, ReminderEffect, ReminderId, SeatId } from '#lib/core/model/types.ts';

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

/** Effects tied to one night and the day before it (a day-long one ends at the New day after). */
const TIMED: readonly ReminderEffectKind[] = ['no-kill', 'no-vote-today', 'no-ability-today'];

/**
 * Whether `effect` acts now, with `days` days begun (`game.pastDays.length`): a timed one only
 * from the day before its night until the next New day (`no-kill` acts on the night itself,
 * `stopsKillingTonight`), the rest while it is marked.
 */
export function effectActs(effect: ReminderEffect | undefined, days: number): boolean {
	if (!effect) return false;
	return TIMED.includes(effect.kind) ? days === effect.night - 1 : true;
}

const IMPAIRS: Partial<Record<ReminderEffectKind, ImpairmentReason>> = {
	poisoned: 'poisoned',
	'no-ability-today': 'no-ability'
};

/** How a picked effect impairs its player's ability now (`abilityState`), if it does. */
export function effectImpairment(
	effect: ReminderEffect | undefined,
	game: Game
): ImpairmentReason | undefined {
	const reason = effect && IMPAIRS[effect.kind];
	return reason && effectActs(effect, game.pastDays.length) ? reason : undefined;
}

/** A picked effect the day view shows as its own line (the rest show elsewhere). */
export const DAY_LINE_EFFECTS = ['mad', 'no-vote-today', 'dies'] as const;
export type DayLineEffect = (typeof DAY_LINE_EFFECTS)[number];

export interface EffectDayLine {
	kind: DayLineEffect;
	/** The marked player. */
	seatId: SeatId;
	/** The character whose reminder carries it (the Angel). */
	source: CharacterId;
}

/**
 * The picked effects the day view lists, on `days` (`game.pastDays.length`): who is mad, who
 * may not vote today, and who dies while they still live.
 */
export function effectDayLines(
	seats: readonly {
		seatId: SeatId;
		dead: boolean;
		reminders: readonly (Reminder & { effect?: ReminderEffect })[];
	}[],
	days: number
): EffectDayLine[] {
	return seats.flatMap((seat) =>
		seat.reminders.flatMap((r): EffectDayLine[] => {
			const kind = r.effect?.kind;
			if (!kind || !(DAY_LINE_EFFECTS as readonly string[]).includes(kind)) return [];
			if (!effectActs(r.effect, days) || (kind === 'dies' && seat.dead)) return [];
			return [{ kind: kind as DayLineEffect, seatId: seat.seatId, source: r.characterId }];
		})
	);
}

/**
 * The living player a `dies` effect on this reminder would kill, for its reminder dialog's Mark
 * dead (the Storyteller confirms, recording the reminder's character as the cause).
 */
export function effectDeath(game: Game, reminderId: ReminderId): SeatId | undefined {
	for (const seatId of game.seating) {
		const seat = game.seats[seatId];
		const r = seat.reminders.find((x) => x.reminderId === reminderId);
		if (r) return r.effect?.kind === 'dies' && !seat.dead ? seatId : undefined;
	}
	return undefined;
}
