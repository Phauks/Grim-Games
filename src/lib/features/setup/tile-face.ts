export type { TileFace } from '#lib/ui/preferences.ts';
import type { TileFace } from '#lib/ui/preferences.ts';
import type { MessageKey } from '#lib/i18n/catalog.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { TILE_SYMBOL_ICONS } from '#lib/ui/icons/catalogue.ts';

/**
 * What a face-down tile on the bag draw shows (Trevor, 2026-10-17): a number, a letter, a
 * symbol, a colour, or Random, which mixes all four. Every tile in a bag shows a different
 * mark, and `name` says it in words for the reveal title and screen readers.
 */
export type TileMark =
	| { kind: 'text'; text: string; name: string }
	| { kind: 'symbol'; icon: string; name: string; repeat?: number }
	| { kind: 'colour'; colour: string; name: string; repeat?: number };

/** Phosphor shapes, each easy to tell apart at tile size; named in the catalog. */
export const TILE_SYMBOLS: readonly { icon: string; key: MessageKey }[] = TILE_SYMBOL_ICONS.map(
	(icon) => ({ icon, key: `setup.tileSymbol.${icon.slice('ph:'.length)}` as MessageKey })
);

/**
 * Colours far enough apart to tell at a glance, as CSS colour keywords: tile colours are
 * content, not theme. Each carries its name, so no one has to tell two apart by hue alone.
 */
export const TILE_COLOURS: readonly { colour: string; key: MessageKey }[] = [
	{ colour: 'red', key: 'setup.tileColour.red' },
	{ colour: 'orange', key: 'setup.tileColour.orange' },
	{ colour: 'gold', key: 'setup.tileColour.yellow' },
	{ colour: 'limegreen', key: 'setup.tileColour.lime' },
	{ colour: 'green', key: 'setup.tileColour.green' },
	{ colour: 'teal', key: 'setup.tileColour.teal' },
	{ colour: 'deepskyblue', key: 'setup.tileColour.sky' },
	{ colour: 'royalblue', key: 'setup.tileColour.blue' },
	{ colour: 'navy', key: 'setup.tileColour.navy' },
	{ colour: 'rebeccapurple', key: 'setup.tileColour.purple' },
	{ colour: 'violet', key: 'setup.tileColour.violet' },
	{ colour: 'magenta', key: 'setup.tileColour.magenta' },
	{ colour: 'hotpink', key: 'setup.tileColour.pink' },
	{ colour: 'saddlebrown', key: 'setup.tileColour.brown' },
	{ colour: 'tan', key: 'setup.tileColour.tan' },
	{ colour: 'maroon', key: 'setup.tileColour.maroon' },
	{ colour: 'olive', key: 'setup.tileColour.olive' },
	{ colour: 'black', key: 'setup.tileColour.black' },
	{ colour: 'gray', key: 'setup.tileColour.grey' },
	{ colour: 'white', key: 'setup.tileColour.white' }
];

/** A, B … Z, then AA, AB …: the letter label for the 1-based tile `number`. */
export function tileLetters(number: number): string {
	let n = number;
	let out = '';
	while (n > 0) {
		const rem = (n - 1) % 26;
		out = String.fromCharCode(65 + rem) + out;
		n = Math.floor((n - 1) / 26);
	}
	return out;
}

/** Symbol and colour names have no placeholders. */
const named = t as (key: MessageKey) => string;

const text = (s: string): TileMark => ({ kind: 'text', text: s, name: s });

/** The n-th entry of a list; past its end the list starts again with a small number, "Red 2". */
function cycle<T>(list: readonly T[], n: number): { item: T; repeat?: number } {
	const round = Math.floor((n - 1) / list.length);
	return { item: list[(n - 1) % list.length], ...(round ? { repeat: round + 1 } : {}) };
}

function symbol(n: number): TileMark {
	const { item, repeat } = cycle(TILE_SYMBOLS, n);
	const name = named(item.key) + (repeat ? ` ${repeat}` : '');
	return { kind: 'symbol', icon: item.icon, name, ...(repeat ? { repeat } : {}) };
}

function colour(n: number): TileMark {
	const { item, repeat } = cycle(TILE_COLOURS, n);
	const name = named(item.key) + (repeat ? ` ${repeat}` : '');
	return { kind: 'colour', colour: item.colour, name, ...(repeat ? { repeat } : {}) };
}

/** A small seeded generator (mulberry32), so a bag's Random marks stay put across reloads. */
function seeded(seed: string): () => number {
	let a = 0;
	for (const ch of seed) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let x = Math.imul(a ^ (a >>> 15), 1 | a);
		x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Random: every mark of every kind for a bag of `size`, shuffled with `seed` (the game), then
 * one per tile. Marks of different kinds never clash ("1" is a number, "A" a letter).
 */
function randomMarks(size: number, seed: string): TileMark[] {
	const pool: TileMark[] = [];
	for (let n = 1; n <= size; n++) pool.push(text(String(n)), text(tileLetters(n)));
	for (let n = 1; n <= TILE_SYMBOLS.length; n++) pool.push(symbol(n));
	for (let n = 1; n <= TILE_COLOURS.length; n++) pool.push(colour(n));
	const random = seeded(seed);
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return pool.slice(0, size);
}

/** The marks for a bag of `size` tiles, tile 1 first. */
export function tileMarks(size: number, face: TileFace, seed: string): TileMark[] {
	if (face === 'random') return randomMarks(size, seed);
	return Array.from({ length: size }, (_, i) => {
		const n = i + 1;
		if (face === 'letters') return text(tileLetters(n));
		if (face === 'symbols') return symbol(n);
		if (face === 'colours') return colour(n);
		return text(String(n));
	});
}
