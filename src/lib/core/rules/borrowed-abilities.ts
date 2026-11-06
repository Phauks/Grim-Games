/**
 * Characters whose ability someone has without being that character (Trevor, 2026-11-04, M50:
 * "if a character also has the ability of a character, we need to make sure we have the
 * reminder tokens to facilitate that ability"). The reminder bank offers their tokens, and
 * placing one is not "not in play", whichever way the ability came:
 * - a player's, by `abilitiesOfSeat`: their token (the Alchemist's Minion, the Apprentice's),
 *   gained (the Pixie's, the Philosopher's in-play choice) or held (the Philosopher's choice not
 *   in play, the Boffin's, the Hermit's, Gain ability);
 * - a held one that does not work just now (a drunk Philosopher), kept so its tokens already
 *   placed stay offered when it comes back;
 * - the Storyteller's (`Game.storytellerAbilities`: the Plague Doctor's Minion).
 * The value says whether a living player (or the Storyteller) has it, so the bank files it with
 * the living rather than the dead.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilitiesOfSeat, heldAbilitiesOf } from './gained-abilities.ts';

export function borrowedAbilities(
	game: Game,
	characters: CharacterLookup
): ReadonlyMap<CharacterId, boolean> {
	const out = new Map<CharacterId, boolean>();
	const add = (id: CharacterId, living: boolean) => out.set(id, out.get(id) === true || living);
	for (const seatId of game.seating) {
		const living = !game.seats[seatId].dead;
		for (const a of abilitiesOfSeat(game, seatId, characters))
			if (a.how !== 'own') add(a.characterId, living);
		for (const held of heldAbilitiesOf(game, seatId, characters)) add(held.characterId, living);
	}
	for (const held of game.storytellerAbilities ?? []) add(held.characterId, true);
	return out;
}

/**
 * The characters whose ability one player has besides their own, each once, in the order the
 * engine lists them: a token's, a gained one, then the held ones (the Hermit's every Outsider,
 * the Philosopher's choice, Gain ability), each with whether it works just now (a held ability
 * does not while its giver is drunk or poisoned). Day view lists them under the player's own
 * character (Trevor, 2026-11-06: "Should apply to anything that has an ability but isnt that
 * character").
 */
export function borrowedAbilitiesOf(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): { characterId: CharacterId; works: boolean }[] {
	const own = game.seats[seatId]?.characterId;
	const out = new Map<CharacterId, boolean>();
	for (const a of abilitiesOfSeat(game, seatId, characters))
		if (a.how !== 'own' && a.characterId !== own) out.set(a.characterId, true);
	for (const h of heldAbilitiesOf(game, seatId, characters))
		if (h.characterId !== own) out.set(h.characterId, out.get(h.characterId) === true || h.works);
	return [...out].map(([characterId, works]) => ({ characterId, works }));
}
