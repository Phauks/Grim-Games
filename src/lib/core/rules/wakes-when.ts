/**
 * Whether a character's own condition for waking holds tonight (`wakesWhen` in its rules
 * block, `data/wakes-when-rules.ts`): the King once the dead equal or outnumber the living,
 * the Choirboy when the Demon killed the King tonight, the Seamstress until its once-per-game
 * ability is used (unless its player acts twice, `acts-twice.ts`: a spent once-per-game ability
 * may be used again). Every condition given must hold; a character without one always may wake.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { actsTwice } from './acts-twice.ts';

export function wakeConditionMet(
	game: Game,
	characterId: CharacterId,
	holder: SeatId,
	characters: CharacterLookup,
	diedTonight: ReadonlySet<SeatId>
): boolean {
	const when = rulesOf(characterId, characters)?.wakesWhen;
	if (!when) return true;
	if (when.deadAtLeastLiving) {
		const dead = game.seating.filter((s) => game.seats[s].dead).length;
		if (dead < game.seating.length - dead) return false;
	}
	if (when.diedTonight) {
		const { characters: ids, by } = when.diedTonight;
		const set = [...diedTonight].some((s) => {
			const id = trueCharacter(game, s, characters);
			if (id === undefined || !ids.includes(id)) return false;
			// A death whose cause was not recorded counts, so the step still shows (warn, never lock).
			const cause = game.seats[s]?.deathCause;
			return (
				!by || cause === undefined || cause === 'demon' || characters.get(cause)?.type === 'demon'
			);
		});
		if (!set) return false;
	}
	if (when.untilToken) {
		const spent = game.seats[holder]?.reminders.some(
			(r) => r.characterId === characterId && r.label === when.untilToken
		);
		if (spent && !actsTwice(game, holder, characters)) return false;
	}
	return true;
}
