/**
 * What special rules change on the board, worked out from the game: who has an ability under
 * The Phantom Detectives, and who Trained Killer's Demon attacks next. The board shows them;
 * the Storyteller decides (warn, never lock).
 */
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { AbilitiesRule } from './types.ts';

/**
 * Whether a player has their ability: alive, as usual; under `dead-keep`, dead players keep it
 * except `deadLose` types, and living `livingLose` types have none until they die
 * (https://schnauzerclub.neocities.org/scripts/thephantomdetectives).
 */
export function hasAbilityUnder(
	rule: AbilitiesRule | undefined,
	dead: boolean,
	type: CharacterType | undefined
): boolean {
	if (!rule) return !dead;
	const lost = dead ? rule.deadLose : rule.livingLose;
	return type === undefined || !(lost as readonly string[]).includes(type);
}

/** Whether this seat's player has their ability under the rule, by their true character. */
export function seatHasAbility(
	rule: AbilitiesRule | undefined,
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): boolean {
	return hasAbilityUnder(rule, !!game.seats[seatId]?.dead, typeOf(game, seatId, characters));
}

const scriptIds = (game: Game): CharacterId[] =>
	game.script.entries.map((e) => (e.kind === 'official' ? e.id : e.character.id));

/**
 * Trained Killer (https://beardytas.com/garden-of-djinn/trained-killer/): the next living
 * in-play character in script order. The page recommends carrying on from the furthest point
 * reached, so it starts after the furthest character the Demon killed (dead with the death
 * cause "demon"), from the top when none, and wraps round at the end (the page doesn't say).
 * Characters off the script are skipped, and so are Demons (our reading: the Demon attacks
 * others). Undefined when no one is left.
 */
export function nextScriptOrderTarget(game: Game, characters: CharacterLookup): SeatId | undefined {
	const order = scriptIds(game);
	const seats = game.seating
		.map((seatId) => {
			const id = trueCharacter(game, seatId, characters);
			return { seatId, at: id === undefined ? -1 : order.indexOf(id) };
		})
		.filter(({ seatId, at }) => at >= 0 && typeOf(game, seatId, characters) !== 'demon')
		.sort((a, b) => a.at - b.at);
	const killed = seats.filter(
		({ seatId }) => game.seats[seatId].dead && game.seats[seatId].deathCause === 'demon'
	);
	const furthest = killed.length ? Math.max(...killed.map((s) => s.at)) : -1;
	const living = seats.filter(({ seatId }) => !game.seats[seatId].dead);
	return (living.find((s) => s.at > furthest) ?? living[0])?.seatId;
}
