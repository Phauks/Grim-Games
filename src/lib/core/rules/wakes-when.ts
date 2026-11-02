/**
 * Whether a character's own condition for waking holds tonight (`wakesWhen` in its rules
 * block, `data/wakes-when-rules.ts`): the King once the dead equal or outnumber the living,
 * the Choirboy when the Demon killed the King tonight, the Seamstress until its once-per-game
 * ability is used. Every condition given must hold; a character without one always may wake.
 * A jinx may lower the King's dead count while its partner is in play (`deadAtLeast`: one
 * dead player is enough with the Leviathan or Riot,
 * https://wiki.bloodontheclocktower.com/King#Related_Jinxes).
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { ownJinxes } from './jinxes.ts';

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
		const jinxed = ownJinxes(game, characterId, (r) => r.deadAtLeast !== undefined, characters)
			.filter(({ partner }) =>
				game.seating.some((s) => trueCharacter(game, s, characters) === partner)
			)
			.some(({ rule }) => dead >= rule.deadAtLeast!);
		if (dead < game.seating.length - dead && !jinxed) return false;
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
		if (spent) return false;
	}
	return true;
}
