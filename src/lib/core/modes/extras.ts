/**
 * Hidden extra characters (pool kind `script-plus-hidden`, A Script of Infinite
 * Possibilities): characters from off the script, picked at random, that only their players
 * know about; the Storyteller may tell the table a range of how many there are
 * (https://chillclocktower.com/2024/04/28/a-script-of-infinite-possibilities/).
 */
import type { Character } from '#lib/core/data/types.ts';
import { SEATED_TYPES, type SeatedType } from '#lib/core/rules/distribution.ts';
import { bannedIn, type StorytellerRestrictions } from './pool.ts';
import type { GameMode } from './types.ts';

/** How many extras of each type the mode adds; none for other pools. */
export function extraCounts(mode: GameMode): Partial<Record<SeatedType, number>> {
	const pool = mode.parts.pool;
	return pool?.kind === 'script-plus-hidden' ? pool.extras : {};
}

/** Off-script official characters a type's extra can be: not restricted, not on the script. */
export function extraCandidates(
	mode: GameMode,
	type: SeatedType,
	scriptCharacters: readonly Character[],
	official: readonly Character[],
	restrictions: StorytellerRestrictions,
	exclude: readonly Character[] = []
): Character[] {
	const banned = bannedIn(mode, restrictions);
	const taken = new Set([...scriptCharacters, ...exclude].map((c) => c.id));
	return official.filter((c) => c.type === type && !taken.has(c.id) && !banned.has(c.id));
}

/** How many extras there are in all: the mode's range, or one for every type's row. */
export function extraTotal(mode: GameMode): { min: number; max: number } {
	const pool = mode.parts.pool;
	const rows = Object.values(extraCounts(mode)).reduce((a, n) => a + (n ?? 0), 0);
	if (pool?.kind !== 'script-plus-hidden' || !pool.count) return { min: rows, max: rows };
	const max = Math.min(rows, pool.count.max);
	return { min: Math.min(max, pool.count.min), max };
}

/**
 * Picks the mode's extras at random, each type from its own candidates, never twice. With a
 * range, a random number of them in that range, their types drawn from the mode's rows.
 */
export function rollExtras(
	mode: GameMode,
	scriptCharacters: readonly Character[],
	official: readonly Character[],
	restrictions: StorytellerRestrictions,
	random: () => number
): Character[] {
	const counts = extraCounts(mode);
	const slots: SeatedType[] = SEATED_TYPES.flatMap((type) =>
		Array.from({ length: counts[type] ?? 0 }, () => type)
	);
	const { min, max } = extraTotal(mode);
	const total = min + Math.floor(random() * (max - min + 1));
	// Keep `total` of the rows, chosen at random, in their order.
	const order = slots.map((_, i) => i);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	const kept = new Set(order.slice(0, total));
	const out: Character[] = [];
	for (const [i, type] of slots.entries()) {
		if (!kept.has(i)) continue;
		const pool = extraCandidates(mode, type, scriptCharacters, official, restrictions, out);
		if (pool.length > 0) out.push(pool[Math.floor(random() * pool.length)]);
	}
	return out;
}

/**
 * A range to tell the table, one either side of the real number and never below none, so
 * players know extras may be in play without learning how many.
 */
export function announcedRange(count: number): [number, number] {
	return [Math.max(0, count - 1), count + 1];
}
