/**
 * Today's yes-or-no facts the Storyteller marks by hand (whether the Demon voted, whether a
 * Minion nominated), for the characters whose `dayMark` rule (`data/parts/day-mark.ts`) says
 * they learn one at night. Marking a fact swaps the character's two tokens on its seat, as the
 * wiki's How to Run does each day (https://wiki.bloodontheclocktower.com/Flowergirl,
 * https://wiki.bloodontheclocktower.com/Town_Crier).
 */
import { DAY_MARKS, type DayMark, type DayMarkRule } from '#lib/core/data/parts/day-mark.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { actsWhenDead, keepsAbilityWhenDead } from '#lib/core/rules/dead-characters.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

export { DAY_MARKS, type DayMark, type DayMarkRule };

/** A character's `dayMark` rule, from the rules block it carries. */
export function dayMarkOf(
	game: Game,
	characterId: CharacterId | undefined,
	characters: CharacterLookup
): DayMarkRule | undefined {
	if (characterId === undefined) return undefined;
	return rulesFor(game, characterId, characters)?.dayMark;
}

/** A seat whose character shows a day mark with its tokens. */
export interface DayMarkSeat {
	seatId: SeatId;
	characterId: CharacterId;
	rule: DayMarkRule;
}

/**
 * The seats, in seating order, whose character shows `mark` (every mark when none is given).
 * A dead player has no ability, so their fact is never asked or swapped (Trevor, 2026-11-03:
 * a dead Town Crier was still asked about), unless their ability acts while dead or another
 * character's token keeps it.
 */
export function dayMarkSeats(
	game: Game,
	characters: CharacterLookup,
	mark?: DayMark
): DayMarkSeat[] {
	return game.seating.flatMap((seatId) => {
		const characterId = game.seats[seatId]?.characterId;
		const rule = dayMarkOf(game, characterId, characters);
		if (!characterId || !rule || (mark && rule.mark !== mark)) return [];
		if (
			game.seats[seatId].dead &&
			!actsWhenDead(characterId, characters) &&
			!keepsAbilityWhenDead(game, seatId, characters)
		)
			return [];
		return [{ seatId, characterId, rule }];
	});
}

/** The marks some character in play learns, in `DAY_MARKS` order. */
export function marksInPlay(game: Game, characters: CharacterLookup): DayMark[] {
	const marks = new Set(dayMarkSeats(game, characters).map((s) => s.rule.mark));
	return DAY_MARKS.filter((m) => marks.has(m));
}

/** Today's mark, or undefined until the Storyteller marks it. */
export const dayMarkValue = (game: Game, mark: DayMark): boolean | undefined =>
	game.today.marks?.[mark];

/** The token that shows `value` on a seat: `yes`, `no`, or none while unmarked. */
export const markToken = (
	rule: DayMarkRule,
	value: boolean | undefined
): ReminderLabel | undefined => (value === undefined ? undefined : value ? rule.yes : rule.no);

/**
 * What marking `mark` as `value` does to the board: on each seat that shows it, the token that
 * no longer matches comes off and the matching one goes on, unless it is already there.
 */
export function markTokenSwap(
	game: Game,
	mark: DayMark,
	value: boolean | undefined,
	characters: CharacterLookup
): {
	remove: ReminderId[];
	add: { seatId: SeatId; characterId: CharacterId; label: ReminderLabel }[];
} {
	const remove: ReminderId[] = [];
	const add: { seatId: SeatId; characterId: CharacterId; label: ReminderLabel }[] = [];
	for (const { seatId, characterId, rule } of dayMarkSeats(game, characters, mark)) {
		const label = markToken(rule, value);
		const own = game.seats[seatId].reminders.filter(
			(r) => r.characterId === characterId && (r.label === rule.yes || r.label === rule.no)
		);
		for (const r of own) if (r.label !== label) remove.push(r.reminderId);
		if (label && !own.some((r) => r.label === label)) add.push({ seatId, characterId, label });
	}
	return { remove, add };
}
