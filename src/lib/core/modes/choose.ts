/**
 * Choosing your own character (assignment kind `choose-own`, Whale Buffet): the bag deals
 * only a character type, and each player chooses a character of that type from the game's
 * choosable characters. Characters that can't be chosen are left out; `onlyFor` characters
 * are offered only to players of that type (only a Demon may choose the Summoner).
 * Duplicates are allowed where the mode allows them. https://whalebuffet.com/
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { SEATED_TYPES, type SeatedType, type TypeCounts } from '#lib/core/rules/distribution.ts';
import type { GameMode } from './types.ts';
import { pickableCharacters } from './pool.ts';

/** One type per dealt player, shuffled like tiles in a bag. */
export function dealTypes(counts: TypeCounts, random: () => number): SeatedType[] {
	const types = SEATED_TYPES.flatMap((type) => Array.from({ length: counts[type] }, () => type));
	for (let i = types.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[types[i], types[j]] = [types[j], types[i]];
	}
	return types;
}

/**
 * The characters a player dealt `type` may choose: choosable characters of that type, plus
 * those reserved for it, minus `taken` unless the mode allows duplicates.
 */
export function chooseOptions(
	mode: GameMode,
	characters: readonly Character[],
	type: SeatedType,
	taken: readonly CharacterId[] = []
): Character[] {
	const onlyFor = mode.parts.restricted?.onlyFor ?? [];
	const reserved = new Map(onlyFor.map((o) => [o.characterId, o.type]));
	const duplicates = mode.parts.duplicates?.kind === 'allowed';
	const used = new Set(duplicates ? [] : taken);
	return pickableCharacters(mode, characters).filter((c) => {
		if (used.has(c.id)) return false;
		const only = reserved.get(c.id);
		return only ? only === type : c.type === type;
	});
}
