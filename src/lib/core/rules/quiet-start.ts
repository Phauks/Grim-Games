/**
 * M15b: a quiet start to each day (`quietStart` in a rules block: the Buddhist,
 * https://wiki.bloodontheclocktower.com/Buddhist). While a character with it is in play, the
 * players it names (the veterans the Storyteller picked) may not talk for the first `seconds`
 * of each day. The day timer counts this down from its own time used (`quietLeft`), so it
 * follows the Storyteller's Start and Pause; who the veterans are is the Storyteller's call.
 */
import { rulesIn } from '#lib/core/data/rules/index.ts';
import type { QuietStart } from '#lib/core/data/parts/quiet-start.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game } from '#lib/core/model/types.ts';

export interface QuietStartRule extends QuietStart {
	characterId: CharacterId;
}

/** The first character in play (a Fabled or Loric, or a player's) with a quiet start. */
export function quietStartRule(
	game: Game,
	characters: CharacterLookup
): QuietStartRule | undefined {
	const ids = new Set<CharacterId>(game.ruleCharacters);
	for (const s of game.seating) {
		const id = trueCharacter(game, s, characters);
		if (id) ids.add(id);
	}
	for (const characterId of ids) {
		const rule = rulesIn(game, characterId, characters)?.quietStart;
		if (rule) return { characterId, ...rule };
	}
	return undefined;
}

/** Milliseconds of quiet left once the day's timer has used `elapsedMs`; 0 once it is over. */
export function quietLeft(rule: { seconds: number }, elapsedMs: number): number {
	return Math.max(0, rule.seconds * 1000 - Math.max(0, elapsedMs));
}
