/**
 * Players reborn as Travellers when they die (`reincarnates` in a rules block): while the
 * Hindu is in play, each of the first four players to die at once becomes a Traveller the
 * Storyteller picks, alive and of the same alignment, however they died
 * (https://wiki.bloodontheclocktower.com/Hindu). When the Storyteller marks such a player dead,
 * the board offers the rebirth; they may leave the death as it is. A Demon among those deaths
 * is not offered one: good wins instead, as the Demon's death already says.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';

/**
 * The character whose rule reincarnates `seatId`, just marked dead: one in play (a Fabled or
 * Loric, or a player's) with rebirths left. Undefined for a living player, one already reborn
 * (a player dies once among the first), or a Demon.
 */
export function reincarnatedBy(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): CharacterId | undefined {
	const seat = game.seats[seatId];
	if (!seat?.dead || game.reincarnated?.includes(seatId)) return undefined;
	if (typeOf(game, seatId, characters) === 'demon') return undefined;
	const reborn = game.reincarnated?.length ?? 0;
	const inPlay = [
		...game.ruleCharacters,
		...game.seating.flatMap((id) => trueCharacter(game, id, characters) ?? [])
	];
	return inPlay.find((id) => {
		const rule = rulesOf(id, characters)?.reincarnates;
		return rule !== undefined && reborn < rule.first;
	});
}
