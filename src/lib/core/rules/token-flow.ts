/**
 * Tokens that take each other's place on a player, by a character's `tokenFlow` rule
 * (`data/token-flow-rules.ts`; Trevor, 2026-11-06: "placing has should request taking mad
 * off"). The Pixie's Has Ability goes where its Mad was
 * (https://wiki.bloodontheclocktower.com/Pixie), the Shabaloth's Alive where its Dead was
 * (https://wiki.bloodontheclocktower.com/Shabaloth), the Pukka's Dead where its Poisoned was
 * (https://wiki.bloodontheclocktower.com/Pukka). The board asks before taking the earlier one
 * off; nothing here acts on its own.
 */
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, ReminderInstance, SeatId } from '#lib/core/model/types.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

/**
 * The reminders on `seatId` that `reminder` takes the place of: the same character's (and the
 * same copy's, when it has an owner) earlier tokens in its flow.
 */
export function replacedByFlow(
	game: Game,
	seatId: SeatId,
	reminder: ReminderInstance,
	characters: CharacterLookup
): ReminderInstance[] {
	const tokens = rulesFor(game, reminder.characterId, characters)?.tokenFlow?.tokens;
	const at = tokens?.indexOf(reminder.label) ?? -1;
	if (!tokens || at <= 0) return [];
	const earlier = tokens.slice(0, at);
	return (game.seats[seatId]?.reminders ?? []).filter(
		(r) =>
			r.reminderId !== reminder.reminderId &&
			r.characterId === reminder.characterId &&
			earlier.includes(r.label) &&
			(r.ownerSeatId === undefined ||
				reminder.ownerSeatId === undefined ||
				r.ownerSeatId === reminder.ownerSeatId)
	);
}
