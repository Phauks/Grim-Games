/**
 * Reminders that say a player changed character or alignment (Trevor, 2026-10-19: "populate
 * a choice to change them into the demon"): the character's `becomes` rule
 * (`data/becomes-rules.ts`). Placing or taking off such a reminder offers the change; the
 * Storyteller confirms it or leaves the player as they are.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, Reminder, SeatId } from '#lib/core/model/types.ts';

/**
 * The change to offer:
 * - `demon`: `seatId` becomes `characterId`, the Demon taken over, as evil;
 * - `evil`: `seatId`, playing `characterId`, turns evil;
 * - `swap`: `seatId`, a Demon, and `withSeatId` swap characters and alignments.
 */
export type BecomesOffer =
	| { into: 'demon' | 'evil'; seatId: SeatId; characterId: CharacterId }
	| { into: 'swap'; seatId: SeatId; withSeatId: SeatId };

/**
 * What `reminder`, just placed on `seatId` (or just taken off it, with `when: 'removed'`),
 * offers; none when its character's rule doesn't say so or the change has nothing to do.
 */
export function becomesOffer(
	game: Game,
	seatId: SeatId,
	reminder: Pick<Reminder, 'characterId' | 'label'>,
	characters: CharacterLookup,
	when: 'placed' | 'removed' = 'placed'
): BecomesOffer | undefined {
	const rule = rulesOf(reminder.characterId, characters)?.becomes;
	if (rule?.token !== reminder.label || (rule.when ?? 'placed') !== when) return undefined;
	if (!game.seats[seatId]) return undefined;
	const isDemon = typeOf(game, seatId, characters) === 'demon';

	if (rule.into === 'evil') {
		const characterId = trueCharacter(game, seatId, characters);
		if (characterId === undefined || alignmentOf(game, seatId) === 'evil') return undefined;
		return { into: 'evil', seatId, characterId };
	}
	if (rule.into === 'swap') {
		// The Demon the token's character chose swaps with that character's player.
		const withSeatId = game.seating.find(
			(id) => id !== seatId && trueCharacter(game, id, characters) === reminder.characterId
		);
		return isDemon && withSeatId !== undefined ? { into: 'swap', seatId, withSeatId } : undefined;
	}
	// The dead Demon's character (the one taken over), else another Demon in play.
	if (isDemon) return undefined;
	const demons = game.seating.filter(
		(id) => id !== seatId && typeOf(game, id, characters) === 'demon'
	);
	const taken = demons.find((id) => game.seats[id].dead) ?? demons[0];
	const characterId = taken === undefined ? undefined : trueCharacter(game, taken, characters);
	return characterId === undefined ? undefined : { into: 'demon', seatId, characterId };
}

/**
 * The player whose `characterId` makes a Demon tonight: its `makesDemon` token is on its own
 * living player (the Summoner's Night 3). The step then asks which player and which Demon.
 */
export function demonMaker(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId | undefined {
	const rule = rulesOf(characterId, characters)?.makesDemon;
	if (!rule) return undefined;
	return game.seating.find(
		(id) =>
			!game.seats[id].dead &&
			trueCharacter(game, id, characters) === characterId &&
			game.seats[id].reminders.some((r) => r.characterId === characterId && r.label === rule.token)
	);
}
