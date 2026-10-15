/**
 * Characters that can cause a death, for the death-cause picker: the script's characters
 * whose ability can kill, cause their own death or cause an execution, plus any such
 * character in play off the script (Travellers, Fabled and Loric can join any game).
 *
 * The data is `death-causes.data.ts`. Returns data only; the UI words it. The picker's
 * general causes (executed, the Demon, something else) are `GENERAL_DEATH_CAUSES`.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import { scriptCharacterIds, type CharacterLookup } from '#lib/core/model/characters.ts';
import { charactersInPlay } from '#lib/core/model/selectors.ts';
import type { Game } from '#lib/core/model/types.ts';
import {
	DEATH_CAUSE_ENTRIES,
	DEATH_KINDS,
	NO_DEATH,
	type DeathCauseEntry,
	type DeathKind
} from './death-causes.data.ts';

export { DEATH_CAUSE_ENTRIES, DEATH_KINDS, NO_DEATH };
export type { DeathCauseEntry, DeathKind };

/**
 * One character the picker can offer. `kind` is `unknown` for a character not in our data
 * (homebrew), except a Demon, which is taken to kill.
 */
export interface DeathCauseOption {
	characterId: CharacterId;
	kind: DeathKind | 'unknown';
}

/** The data entry for an official character that can cause a death, if any. */
export function deathCauseEntry(id: CharacterId): DeathCauseEntry | undefined {
	return Object.hasOwn(DEATH_CAUSE_ENTRIES, id) ? DEATH_CAUSE_ENTRIES[id] : undefined;
}

/**
 * The characters that can cause a death: those on the script in script order, then those
 * in `inPlay` that are not on the script (a Traveller in play, the Fabled and Loric in
 * play), in that order, each once.
 */
export function deathCauses(
	scriptIds: Iterable<CharacterId>,
	characters: CharacterLookup,
	inPlay: Iterable<CharacterId> = []
): DeathCauseOption[] {
	const ids = [...new Set([...scriptIds, ...inPlay])];
	const present = new Set(ids);
	const out: DeathCauseOption[] = [];
	for (const id of ids) {
		const entry = deathCauseEntry(id);
		if (entry) {
			if (!entry.onlyWith || entry.onlyWith.some((other) => present.has(other))) {
				out.push({ characterId: id, kind: entry.kind });
			}
		} else if (!Object.hasOwn(NO_DEATH, id)) {
			const type = characters.get(id)?.type;
			if (type !== undefined) {
				out.push({ characterId: id, kind: type === 'demon' ? 'kills' : 'unknown' });
			}
		}
	}
	return out;
}

/** `deathCauses` for a game: its script, the characters on seats and the Fabled and Loric. */
export function gameDeathCauses(game: Game, characters: CharacterLookup): DeathCauseOption[] {
	return deathCauses(scriptCharacterIds(game.script), characters, [
		...charactersInPlay(game),
		...game.ruleCharacters
	]);
}
