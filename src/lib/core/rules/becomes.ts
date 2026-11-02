/**
 * Reminders that say a player changed character or alignment (Trevor, 2026-10-19: "populate
 * a choice to change them into the demon"): the character's `becomes` rule
 * (`data/becomes-rules.ts`). Placing or taking off such a reminder offers the change; the
 * Storyteller confirms it or leaves the player as they are.
 */
import { rulesIn } from '#lib/core/data/rules/index.ts';
import { baseCounts } from './distribution.ts';
import type { Alignment, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { aliveNeighbours, alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
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
	const rule = rulesIn(game, reminder.characterId, characters)?.becomes;
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
 * The alignment change `seatId`'s new alignment offers: a player whose character follows the
 * alignment of the player its token marks (`becomes.follows`, the Ogre's optional rule,
 * https://wiki.bloodontheclocktower.com/Ogre) takes it too. None when no such token is on
 * `seatId` or its player already has that alignment.
 */
export function followedAlignmentOffer(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): BecomesOffer | undefined {
	for (const reminder of game.seats[seatId]?.reminders ?? []) {
		if (!rulesIn(game, reminder.characterId, characters)?.becomes?.follows) continue;
		const offer = becomesOffer(game, seatId, reminder, characters);
		if (offer) return offer;
	}
	return undefined;
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
	const rules = rulesIn(game, characterId, characters);
	const rule = rules?.changesCharacter;
	if (!rule) return undefined;
	const carries = (id: SeatId, label: string) =>
		game.seats[id].reminders.some((r) => r.characterId === characterId && r.label === label);
	if (rule.firstNight && game.pastDays.length > 0) return undefined;
	if (rule.upTo === 'minions' && minionsLeft(game, characters) <= 0) return undefined;
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
 * How many more Minions the player count usually has than are in play (`upTo: 'minions'`,
 * the Kazali's): Travellers are not counted.
 */
export function minionsLeft(game: Game, characters: CharacterLookup): number {
	const dealt = game.seating.filter((id) => typeOf(game, id, characters) !== 'traveller');
	const minions = dealt.filter((id) => typeOf(game, id, characters) === 'minion').length;
	return baseCounts(dealt.length).minion - minions;
}

/**
 * The players `characterId`'s `changesCharacter` may change: all, its `onlyFrom` ones, or
 * with `sameType` the players of its `types` (the Hatter's Minions and Demon); never one its
 * `notMarked` token is on (the Cacklejack's Not Me), nor a Traveller with `notTravellers`.
 */
export function changeableSeats(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const rule = rulesIn(game, characterId, characters)?.changesCharacter;
	return game.seating.filter((id) => {
		const own = trueCharacter(game, id, characters);
		if (rule?.notTravellers && typeOf(game, id, characters) === 'traveller') return false;
		if (rule?.upTo) {
			const type = typeOf(game, id, characters);
			if (own === characterId || (type && (rule.types as readonly string[]).includes(type)))
				return false;
		}
		if (rule?.onlyFrom && (own === undefined || !rule.onlyFrom.includes(own))) return false;
		if (
			rule?.notMarked &&
			game.seats[id].reminders.some(
				(r) => r.characterId === characterId && r.label === rule.notMarked
			)
		)
			return false;
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
	const rule = rulesIn(game, characterId, characters)?.swapsCharacters;
	if (!rule) return [];
	return game.seating.filter((id) => {
		const type = typeOf(game, id, characters);
		return type !== undefined && !(rule.notTypes as readonly string[] | undefined)?.includes(type);
	});
}

/**
 * The alignments `characterId`'s player may take tonight (`takesNeighbourAlignment`: the Cult
 * Leader, https://wiki.bloodontheclocktower.com/Cult_Leader): its living player, and the
 * alignments of their living neighbours, one when both agree, both when they differ (the
 * Storyteller picks). None without such a player or a neighbour with an alignment.
 */
export function neighbourAlignments(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): { seatId: SeatId; alignments: Alignment[] } | undefined {
	if (!rulesIn(game, characterId, characters)?.takesNeighbourAlignment) return undefined;
	const seatId = game.seating.find(
		(id) => !game.seats[id].dead && trueCharacter(game, id, characters) === characterId
	);
	if (seatId === undefined) return undefined;
	const alignments = [
		...new Set(aliveNeighbours(game, seatId).flatMap((id) => alignmentOf(game, id) ?? []))
	].sort();
	return alignments.length ? { seatId, alignments } : undefined;
}

/**
 * The players who may become `characterId` when its player dies (`passesOn`: the Farmer's
 * alive good player, https://wiki.bloodontheclocktower.com/Farmer): alive ones when the rule
 * says so, of its alignment when it names one, and never a player who already is that
 * character. Empty for a character without the rule. The Storyteller picks among them.
 */
export function passOnSeats(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const rule = rulesIn(game, characterId, characters)?.passesOn;
	if (!rule) return [];
	return game.seating.filter(
		(id) =>
			trueCharacter(game, id, characters) !== characterId &&
			(!rule.alive || !game.seats[id].dead) &&
			(!rule.alignment || alignmentOf(game, id) === rule.alignment)
	);
}
