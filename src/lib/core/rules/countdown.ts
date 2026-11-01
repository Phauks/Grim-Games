/**
 * Counting down a character's reminder token each night (`countdown` in its rules,
 * `data/countdown-rules.ts`): the Courtier's Drunk 3 becomes Drunk 2, then Drunk 1, then comes
 * off, so the drunkenness lasts 3 nights and 3 days
 * (https://wiki.bloodontheclocktower.com/Courtier). The night step offers it; the Storyteller
 * decides, so nothing here happens on its own.
 */
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, ReminderId, SeatId } from '#lib/core/model/types.ts';

/** One token to count down: `to` is the next label, or undefined when it comes off. */
export interface CountdownMove {
	seatId: SeatId;
	reminderId: ReminderId;
	from: ReminderLabel;
	to?: ReminderLabel;
}

/**
 * The countdown tokens of `characterId` on the board, each with its next label. With `since`
 * (the game at the last dawn), only tokens already there then: a token placed tonight starts
 * counting tomorrow night, and one counted down tonight is not counted again.
 */
export function countdownMoves(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup,
	since?: Game
): CountdownMove[] {
	const tokens = rulesOf(characterId, characters)?.countdown?.tokens;
	if (!tokens) return [];
	const before = since
		? new Set(
				game.seating.flatMap((id) => since.seats[id]?.reminders.map((r) => r.reminderId) ?? [])
			)
		: undefined;
	return game.seating.flatMap((seatId) =>
		game.seats[seatId].reminders.flatMap((r): CountdownMove[] => {
			const at = tokens.indexOf(r.label);
			if (r.characterId !== characterId || at < 0) return [];
			if (before && !before.has(r.reminderId)) return [];
			const to = tokens[at + 1];
			return [{ seatId, reminderId: r.reminderId, from: r.label, ...(to ? { to } : {}) }];
		})
	);
}
