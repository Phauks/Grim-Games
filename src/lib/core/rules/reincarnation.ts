/**
 * Players reborn as Travellers when they die (`reincarnates` in a rules block): while the
 * Hindu is in play, each of the first four players to die at once becomes a Traveller the
 * Storyteller picks, alive and of the same alignment, however they died
 * (https://wiki.bloodontheclocktower.com/Hindu). When the Storyteller marks such a player dead,
 * the board offers the rebirth; they may leave the death as it is. A Demon among those deaths
 * ends the game with a win for good, unless the Storyteller uses the Hindu's optional rule
 * (`demonTo`): the Demon is reborn too and a living Minion becomes that Demon.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/**
 * The character whose rule reincarnates `seatId`, just marked dead: one in play (a Fabled or
 * Loric, or a player's) with rebirths left. Undefined for a living player, one already reborn
 * (a player dies once among the first), or a Demon unless the rule passes the Demon on
 * (`demonTo`) and someone can take it.
 */
export function reincarnatedBy(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const seat = game.seats[seatId];
	if (!seat?.dead || game.reincarnated?.includes(seatId)) return undefined;
	const demon = isDemon(game, seatId, characters);
	const reborn = game.reincarnated?.length ?? 0;
	const inPlay = [
		...game.ruleCharacters,
		...game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? [])
	];
	return inPlay.find((id) => {
		const rule = rulesOf(id, characters)?.reincarnates;
		if (rule === undefined || reborn >= rule.first) return false;
		return !demon || demonHeirs(game, seatId, id, characters).length > 0;
	});
}

/**
 * The living players who may become the Demon `seatId` played, reborn by `via`'s rule: its
 * `demonTo` type (the Hindu's Minions). None when `seatId` is no Demon, or the rule doesn't
 * pass the Demon on.
 */
export function demonHeirs(
	game: Game,
	seatId: SeatId,
	via: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	const to = rulesOf(via, characters)?.reincarnates?.demonTo;
	if (to === undefined || !isDemon(game, seatId, characters)) return [];
	return game.seating.filter(
		(id) => id !== seatId && !game.seats[id].dead && typeOf(game, id, characters) === to
	);
}

function isDemon(game: Game, seatId: SeatId, characters: CharacterLookup): boolean {
	return typeOf(game, seatId, characters) === 'demon';
}
