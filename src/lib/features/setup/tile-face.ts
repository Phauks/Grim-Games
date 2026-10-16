import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

export type { TileFace } from '#lib/ui/preferences.ts';

/**
 * Icons a tile may show in place of its number: everyday interface icons only, never ones
 * with a game meaning (dead, Demon, poisoned, Traveller...) that could hint at the token.
 */
export const TILE_SYMBOLS: readonly IconSlot[] = [
	'night',
	'day',
	'vote',
	'bag',
	'reminder',
	'players',
	'script',
	'notes',
	'settings',
	'account',
	'appearance',
	'fonts',
	'icons',
	'menu',
	'info',
	'search',
	'report',
	'reference',
	'sort',
	'filter',
	'assistance',
	'rename',
	'move',
	'swap',
	'grimoire',
	'arrange',
	'more',
	'history',
	'share',
	'wiki'
];

/** FNV-1a, so the same bag always gets the same symbols. */
function hash(text: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/**
 * A different symbol for each tile, picked at random from `TILE_SYMBOLS` but fixed for the
 * bag (seeded by its tile ids), so a tile keeps its symbol across reloads. Tiles beyond the
 * pool size reuse symbols in the same shuffled order.
 */
export function tileSymbols(tileIds: readonly string[]): IconSlot[] {
	let seed = hash(tileIds.join('|')) || 1;
	const next = () => {
		// xorshift32
		seed ^= seed << 13;
		seed ^= seed >>> 17;
		seed ^= seed << 5;
		return (seed >>> 0) / 0x100000000;
	};
	const pool = [...TILE_SYMBOLS];
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(next() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return tileIds.map((_, i) => pool[i % pool.length]);
}
