/**
 * The Summoner's end with no Demon made (`gameEnd.ends` `dead-without-demon`), split from
 * `game-end.ts`: also for a player who has its ability from their token by a jinx with its
 * own winner (the Alchemist-Summoner, `gainedEndWinner`).
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game } from '#lib/core/model/types.ts';
import type { GameEnd } from './game-end.ts';
import { aliveForEnd, demonSeats, endsOf, wikiOf } from './game-end-helpers.ts';
import { gainedEnd } from './jinx-effects.ts';
import { dayNumber } from './night-order.ts';

/**
 * There is no Demon and its players are dead (the Summoner, who can no longer summon one:
 * https://wiki.bloodontheclocktower.com/Summoner), or its rule's `night` is over and still no
 * Demon was made (a Summoner drunk or poisoned on its 3rd night, M15j). Before that night ends,
 * no Demon is no end.
 */
export function deadWithoutDemon(game: Game, characters: CharacterLookup): GameEnd[] {
	if (demonSeats(game, characters).length > 0) return [];
	// A player with its ability from their token, by a jinx with its own winner (the
	// Alchemist-Summoner, https://wiki.bloodontheclocktower.com/Alchemist#Related_Jinxes): only
	// their death counts.
	const gained = game.seating.flatMap((seatId) => {
		const jinx = gainedEnd(game, seatId, characters);
		const ends = jinx ? rulesOf(jinx.partner, characters)?.gameEnd?.ends : undefined;
		const end = ends?.find((e) => e.kind === 'dead-without-demon');
		return jinx && end
			? [
					{
						seatId,
						characterId: jinx.partner,
						rule: { ...end, winner: jinx.winner, night: undefined }
					}
				]
			: [];
	});
	const found = [...endsOf(game, characters, 'dead-without-demon'), ...gained];
	const over = ({ seatId, rule }: (typeof found)[number]) =>
		!aliveForEnd(game, seatId, characters) ||
		(rule.night !== undefined && dayNumber(game) >= rule.night);
	if (found.length === 0 || !found.every(over)) return [];
	const seats = found.map((f) => f.seatId);
	const { characterId, rule } = found[0];
	// A living player of it: its night passed with no Demon made (`day` names that night).
	const alive = seats.some((id) => aliveForEnd(game, id, characters));
	return [
		{
			key: `dead-without-demon:${seats.join(',')}${alive ? ':night' : ''}`,
			rule: 'dead-without-demon',
			winner: rule.winner!,
			characterId,
			seats,
			...(alive && rule.night !== undefined ? { day: rule.night } : {}),
			wiki: wikiOf(characterId, characters),
			holds: []
		}
	];
}
