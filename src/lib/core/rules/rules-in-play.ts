/**
 * A character's rules as they are in a game (M61): its block (`rulesIn`: with its optional rule
 * when the game turned it on), with each jinx `patch` in effect laid over it. A jinx patch is
 * "while both are on the script and its `when` holds, these parts in place of the character's
 * own" (`data/jinx-rules.ts`), so a jinx can change anything a rules block can say. An older
 * verb that is a patch counts as one (`data/jinx-presets.ts`).
 */
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import { jinxPatches } from '#lib/core/data/jinx-presets.ts';
import { rulesIn } from '#lib/core/data/rules/index.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { aboutHolder, jinxApplies } from './jinx-when.ts';
import { ownJinxes } from './jinxes.ts';

/**
 * `characterId`'s rules in `game`, its jinx patches in effect included. `at` names the player
 * the rules are read for, for a patch whose `when` is about its player (`self-alive`). A patch
 * about a player with the partner's ability (`has-partner-ability`) is left out here: that
 * player's rules are another character's.
 */
export function rulesInPlay(
	game: Game,
	characterId: CharacterId,
	characters?: CharacterLookup,
	at: { seatId?: SeatId } = {}
): CharacterRules | undefined {
	const own = rulesIn(game, characterId, characters);
	if (!game.script) return own;
	const patches = ownJinxes(game, characterId, (r) => jinxPatches(r).length > 0, characters)
		.flatMap(({ partner, rule }) => jinxPatches(rule).map((patch) => ({ partner, patch })))
		.filter(
			({ partner, patch }) =>
				!aboutHolder(patch) && jinxApplies(game, characterId, partner, patch, characters, at)
		);
	if (patches.length === 0) return own;
	return patches.reduce<CharacterRules>((rules, { patch }) => ({ ...rules, ...patch.parts }), {
		...own
	});
}
