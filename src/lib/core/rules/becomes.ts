/**
 * Reminders that say a player changed character or alignment (Trevor, 2026-10-19: "populate
 * a choice to change them into the demon"): the character's `becomes` rule
 * (`data/becomes-rules.ts`). Placing or taking off such a reminder offers the change; the
 * Storyteller confirms it or leaves the player as they are.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, Reminder, SeatId } from '#lib/core/model/types.ts';

/**
 * The change to offer:
 * - `demon`: `seatId` becomes `characterId`, the Demon taken over, as evil;
 * - `evil`: `seatId`, playing `characterId`, turns evil;
 * - `swap`: `seatId`, a Demon, and `withSeatId` swap characters and alignments;
 * - `alignment`: `seatId`, playing `characterId`, takes `alignment` (the carrier's).
 */
export type BecomesOffer =
	| { into: 'demon' | 'evil'; seatId: SeatId; characterId: CharacterId }
	| { into: 'alignment'; seatId: SeatId; characterId: CharacterId; alignment: Alignment }
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
	if (rule.into === 'carrier-alignment') {
		// The token's character's own player takes the carrier's alignment.
		const alignment = alignmentOf(game, seatId);
		const owner = game.seating.find(
			(id) => id !== seatId && trueCharacter(game, id, characters) === reminder.characterId
		);
		if (owner === undefined || alignment === undefined) return undefined;
		if (alignmentOf(game, owner) === alignment) return undefined;
		return { into: 'alignment', seatId: owner, characterId: reminder.characterId, alignment };
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
 * The player whose `characterId` changes a chosen player's character tonight
 * (`changesCharacter`): its own living player (or dead, when it acts when dead: the Hatter),
 * with its `token` on them when the rule names one (the Summoner's Night 3) and without its
 * `spent` token (the Huntsman's No Ability), and someone to change when only some characters
 * change (the Huntsman's Damsel, the Hatter's Minions and Demon).
 */
export function characterChanger(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId | undefined {
	const rules = rulesOf(characterId, characters);
	const rule = rules?.changesCharacter;
	if (!rule) return undefined;
	const carries = (id: SeatId, label: string) =>
		game.seats[id].reminders.some((r) => r.characterId === characterId && r.label === label);
	const changer = game.seating.find(
		(id) =>
			(!game.seats[id].dead || rules?.actsWhenDead === true) &&
			trueCharacter(game, id, characters) === characterId &&
			(rule.token === undefined || carries(id, rule.token)) &&
			(rule.spent === undefined || !carries(id, rule.spent))
	);
	if (changer === undefined) return undefined;
	return changeableSeats(game, characterId, characters).length > 0 ? changer : undefined;
}

/**
 * The players `characterId`'s `changesCharacter` may change: all, its `onlyFrom` ones, or
 * with `sameType` the players of its `types` (the Hatter's Minions and Demon).
 */
export function changeableSeats(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const rule = rulesOf(characterId, characters)?.changesCharacter;
	return game.seating.filter((id) => {
		const own = trueCharacter(game, id, characters);
		if (rule?.onlyFrom && (own === undefined || !rule.onlyFrom.includes(own))) return false;
		if (!rule?.sameType) return true;
		const type = typeOf(game, id, characters);
		return type !== undefined && (rule.types as readonly string[]).includes(type);
	});
}

/**
 * The players `characterId`'s `swapsCharacters` may choose to swap: those with a character,
 * except its `notTypes` (the Barber's "not another Demon").
 */
export function swappableSeats(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const rule = rulesOf(characterId, characters)?.swapsCharacters;
	if (!rule) return [];
	return game.seating.filter((id) => {
		const type = typeOf(game, id, characters);
		return type !== undefined && !(rule.notTypes as readonly string[] | undefined)?.includes(type);
	});
}
