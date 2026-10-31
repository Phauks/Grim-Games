/**
 * Players reborn as Travellers when they die (`reincarnates` in a rules block): while the
 * Hindu is in play, each of the first four players to die at once becomes a Traveller the
 * Storyteller picks, alive and of the same alignment, however they died
 * (https://wiki.bloodontheclocktower.com/Hindu). When the Storyteller marks such a player dead,
 * the board offers the rebirth; they may leave the death as it is. A Demon among those deaths
 * ends the game with a win for good instead (`gameEnds`), unless the game plays with the
 * Hindu's optional rule (`demonTo`, chosen at the start): then the Demon is offered the
 * rebirth too, and a living Minion becomes that Demon.
 */
import { rulesIn } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/**
 * The character whose rule reincarnates `seatId`, just marked dead: one in play (a Fabled or
 * Loric, or a player's) with rebirths left. Undefined for a living player, one already reborn
 * (a player dies once among the first), or a Demon: a Demon among them ends the game instead
 * (`rebirthOf`, used by `gameEnds`), unless the optional rule passes it to someone alive.
 */
export function reincarnatedBy(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const via = rebirthOf(game, seatId, characters);
	if (!via || !isDemon(game, seatId, characters)) return via;
	return demonHeirs(game, seatId, via, characters).length > 0 ? via : undefined;
}

/**
 * The living players who may become the Demon `seatId` played, reborn by `via`'s rule: its
 * `demonTo` type (the Hindu's Minions, under its optional rule). None when `seatId` is no
 * Demon, or the game's rules don't pass the Demon on.
 */
export function demonHeirs(
	game: Game,
	seatId: SeatId,
	via: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const to = rulesIn(game, via, characters)?.reincarnates?.demonTo;
	if (to === undefined || !isDemon(game, seatId, characters)) return [];
	return game.seating.filter(
		(id) => id !== seatId && !game.seats[id].dead && typeOf(game, id, characters) === to
	);
}

/**
 * The character whose rule counts `seatId`, just marked dead, among the first to die, Demon
 * or not. For a Demon that means the game ends and good wins
 * (https://wiki.bloodontheclocktower.com/Hindu).
 */
export function rebirthOf(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const seat = game.seats[seatId];
	if (!seat?.dead || game.reincarnated?.includes(seatId)) return undefined;
	const reborn = game.reincarnated?.length ?? 0;
	const inPlay = [
		...game.ruleCharacters,
		...game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? [])
	];
	return inPlay.find((id) => {
		const rule = rulesIn(game, id, characters)?.reincarnates;
		return rule !== undefined && reborn < rule.first;
	});
}

function isDemon(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return typeOf(game, seatId, characters) === 'demon';
}
