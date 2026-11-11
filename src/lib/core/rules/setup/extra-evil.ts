/**
 * Extra evil players (https://wiki.bloodontheclocktower.com/Spirit_of_Ivory: no more than one
 * extra evil player): good-type players who are evil, or evil players beyond the usual number
 * for the setup, whichever is more. The second counts a good player turned into an evil
 * character, such as an Outsider the Fang Gu jumped into.
 */
import type { Character } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { analyseSetup } from './setup.ts';

/** How many extra evil players there are, counting `turning` as evil too. */
export function extraEvilPlayers(
	game: Game,
	characters: CharacterLookup,
	turning?: SeatId
): number {
	const dealt = game.seating.filter((id) => {
		const type = typeOf(game, id, characters);
		return type !== undefined && type !== 'traveller';
	});
	const evil = dealt.filter((id) => id === turning || alignmentOf(game, id) === 'evil');
	const goodTypes = evil.filter((id) => {
		const type = typeOf(game, id, characters);
		return type === 'townsfolk' || type === 'outsider';
	}).length;
	const inPlay = dealt.flatMap((id): Character[] => {
		const character = characters.get(trueCharacter(game, id, characters) ?? '');
		return character ? [character] : [];
	});
	const { expected } = analyseSetup({
		players: dealt.length,
		travellers: 0,
		inPlay,
		findById: (id) => characters.get(id)
	});
	const usual = Math.max(0, ...expected.minion) + Math.max(0, ...expected.demon);
	return Math.max(goodTypes, evil.length - usual);
}
