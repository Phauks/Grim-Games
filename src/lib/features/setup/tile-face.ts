export type { TileFace } from '#lib/ui/preferences.ts';
import { TILE_FACES, type TileFace } from '#lib/ui/preferences.ts';
import type { MessageKey } from '#lib/i18n/catalog.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { TILE_SYMBOL_ICONS } from '#lib/ui/icons/catalogue.ts';

/**
 * What a face-down tile on the bag draw shows (Trevor, 2026-10-17): a number, a letter, a
 * symbol, a colour, an emoji, or Random, which mixes them all. Every tile in a bag shows a different
 * mark, and `name` says it in words for the reveal title and screen readers.
 */
export type TileMark =
	| { kind: 'text'; text: string; name: string }
	| { kind: 'symbol'; icon: string; name: string; repeat?: number }
	| { kind: 'emoji'; emoji: string; name: string; repeat?: number }
	| { kind: 'colour'; colour: string; ink: 'black' | 'white'; name: string; repeat?: number };

/** Phosphor shapes, each easy to tell apart at tile size; named in the catalog. */
export const TILE_SYMBOLS: readonly { icon: string; key: MessageKey }[] = TILE_SYMBOL_ICONS.map(
	(icon) => ({ icon, key: `setup.tileSymbol.${icon.slice('ph:'.length)}` as MessageKey })
);

/**
 * Colours far enough apart to tell at a glance, as CSS colour keywords: tile colours are
 * content, not theme. Each carries its name, so no one has to tell two apart by hue alone.
 */
export const TILE_COLOURS: readonly { colour: string; ink: 'black' | 'white'; key: MessageKey }[] =
	[
		{ colour: 'red', ink: 'white', key: 'setup.tileColour.red' },
		{ colour: 'orange', ink: 'black', key: 'setup.tileColour.orange' },
		{ colour: 'gold', ink: 'black', key: 'setup.tileColour.yellow' },
		{ colour: 'limegreen', ink: 'black', key: 'setup.tileColour.lime' },
		{ colour: 'green', ink: 'white', key: 'setup.tileColour.green' },
		{ colour: 'teal', ink: 'white', key: 'setup.tileColour.teal' },
		{ colour: 'deepskyblue', ink: 'black', key: 'setup.tileColour.sky' },
		{ colour: 'royalblue', ink: 'white', key: 'setup.tileColour.blue' },
		{ colour: 'navy', ink: 'white', key: 'setup.tileColour.navy' },
		{ colour: 'rebeccapurple', ink: 'white', key: 'setup.tileColour.purple' },
		{ colour: 'violet', ink: 'black', key: 'setup.tileColour.violet' },
		{ colour: 'magenta', ink: 'black', key: 'setup.tileColour.magenta' },
		{ colour: 'hotpink', ink: 'black', key: 'setup.tileColour.pink' },
		{ colour: 'saddlebrown', ink: 'white', key: 'setup.tileColour.brown' },
		{ colour: 'tan', ink: 'black', key: 'setup.tileColour.tan' },
		{ colour: 'maroon', ink: 'white', key: 'setup.tileColour.maroon' },
		{ colour: 'olive', ink: 'white', key: 'setup.tileColour.olive' },
		{ colour: 'black', ink: 'white', key: 'setup.tileColour.black' },
		{ colour: 'gray', ink: 'black', key: 'setup.tileColour.grey' },
		{ colour: 'white', ink: 'black', key: 'setup.tileColour.white' }
	];

/** Emoji that look nothing alike, each with its name in words (Trevor, 2026-10-17). */
export const TILE_EMOJI: readonly { emoji: string; key: MessageKey }[] = [
	{ emoji: '🍎', key: 'setup.tileEmoji.apple' },
	{ emoji: '🍌', key: 'setup.tileEmoji.banana' },
	{ emoji: '🍇', key: 'setup.tileEmoji.grapes' },
	{ emoji: '🍒', key: 'setup.tileEmoji.cherries' },
	{ emoji: '🍄', key: 'setup.tileEmoji.mushroom' },
	{ emoji: '🌵', key: 'setup.tileEmoji.cactus' },
	{ emoji: '🌻', key: 'setup.tileEmoji.sunflower' },
	{ emoji: '🐸', key: 'setup.tileEmoji.frog' },
	{ emoji: '🐙', key: 'setup.tileEmoji.octopus' },
	{ emoji: '🦊', key: 'setup.tileEmoji.fox' },
	{ emoji: '🐝', key: 'setup.tileEmoji.bee' },
	{ emoji: '🦉', key: 'setup.tileEmoji.owl' },
	{ emoji: '🐢', key: 'setup.tileEmoji.turtle' },
	{ emoji: '🦋', key: 'setup.tileEmoji.butterfly' },
	{ emoji: '🐳', key: 'setup.tileEmoji.whale' },
	{ emoji: '🎈', key: 'setup.tileEmoji.balloon' },
	{ emoji: '🎲', key: 'setup.tileEmoji.die' },
	{ emoji: '🎩', key: 'setup.tileEmoji.hat' },
	{ emoji: '🚀', key: 'setup.tileEmoji.rocket' },
	{ emoji: '🍕', key: 'setup.tileEmoji.pizza' },
	{ emoji: '🌈', key: 'setup.tileEmoji.rainbow' },
	{ emoji: '🔥', key: 'setup.tileEmoji.fire' },
	{ emoji: '🍩', key: 'setup.tileEmoji.doughnut' },
	{ emoji: '🐧', key: 'setup.tileEmoji.penguin' },
	{ emoji: '🌮', key: 'setup.tileEmoji.taco' }
];

/**
 * The 24 runes of the Elder Futhark in futhark order, each with its name for the reveal title
 * and screen readers (Trevor, 2026-10-31). Android draws them from its system Noto Sans Runic.
 */
export const TILE_RUNES: readonly { rune: string; key: MessageKey }[] = [
	{ rune: 'ᚠ', key: 'setup.tileRune.fehu' },
	{ rune: 'ᚢ', key: 'setup.tileRune.uruz' },
	{ rune: 'ᚦ', key: 'setup.tileRune.thurisaz' },
	{ rune: 'ᚨ', key: 'setup.tileRune.ansuz' },
	{ rune: 'ᚱ', key: 'setup.tileRune.raidho' },
	{ rune: 'ᚲ', key: 'setup.tileRune.kaunan' },
	{ rune: 'ᚷ', key: 'setup.tileRune.gebo' },
	{ rune: 'ᚹ', key: 'setup.tileRune.wunjo' },
	{ rune: 'ᚺ', key: 'setup.tileRune.hagalaz' },
	{ rune: 'ᚾ', key: 'setup.tileRune.naudiz' },
	{ rune: 'ᛁ', key: 'setup.tileRune.isaz' },
	{ rune: 'ᛃ', key: 'setup.tileRune.jera' },
	{ rune: 'ᛇ', key: 'setup.tileRune.eihwaz' },
	{ rune: 'ᛈ', key: 'setup.tileRune.perthro' },
	{ rune: 'ᛉ', key: 'setup.tileRune.algiz' },
	{ rune: 'ᛊ', key: 'setup.tileRune.sowilo' },
	{ rune: 'ᛏ', key: 'setup.tileRune.tiwaz' },
	{ rune: 'ᛒ', key: 'setup.tileRune.berkanan' },
	{ rune: 'ᛖ', key: 'setup.tileRune.ehwaz' },
	{ rune: 'ᛗ', key: 'setup.tileRune.mannaz' },
	{ rune: 'ᛚ', key: 'setup.tileRune.laguz' },
	{ rune: 'ᛜ', key: 'setup.tileRune.ingwaz' },
	{ rune: 'ᛞ', key: 'setup.tileRune.dagaz' },
	{ rune: 'ᛟ', key: 'setup.tileRune.othala' }
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

const ROMAN: readonly [number, string][] = [
	[1000, 'M'],
	[900, 'CM'],
	[500, 'D'],
	[400, 'CD'],
	[100, 'C'],
	[90, 'XC'],
	[50, 'L'],
	[40, 'XL'],
	[10, 'X'],
	[9, 'IX'],
	[5, 'V'],
	[4, 'IV'],
	[1, 'I']
];

/** I, II … IX, X …: the Roman numeral for the 1-based tile `number` (Trevor, 2026-10-19). */
export function tileRoman(number: number): string {
	let n = number;
	let out = '';
	for (const [value, numeral] of ROMAN) {
		while (n >= value) {
			out += numeral;
			n -= value;
		}
	}
	return out;
}

const KANJI_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/**
 * 一, 二 … 十, 十一 … 二十, 四十: the Japanese kanji numeral for the 1-based tile `number`
 * (Trevor, 2026-10-31). Tens and hundreds are written as a digit before 十 or 百, with no 一
 * before a lone ten or hundred. These are ordinary CJK characters, so a phone without a
 * Japanese font still draws them from its system CJK fallback.
 */
export function tileKanji(number: number): string {
	const hundreds = Math.floor(number / 100);
	const tens = Math.floor((number % 100) / 10);
	const ones = number % 10;
	const place = (digit: number, unit: string) =>
		digit === 0 ? '' : (digit === 1 ? '' : KANJI_DIGITS[digit]) + unit;
	return place(hundreds, '百') + place(tens, '十') + KANJI_DIGITS[ones];
}

/**
 * ᚠ, ᚢ … ᛟ, then ᚠᚠ, ᚠᚢ …: the rune label for the 1-based tile `number`, counted like the
 * letters past the end of the futhark, so the 40 seats of several towns still all differ.
 */
export function tileRunes(number: number): string[] {
	let n = number;
	const out: string[] = [];
	while (n > 0) {
		const rem = (n - 1) % TILE_RUNES.length;
		out.unshift(TILE_RUNES[rem].rune);
		n = Math.floor((n - 1) / TILE_RUNES.length);
	}
	return out;
}

/** A tile mark's name in words; the catalog keys above take no parameters. */
export const named = t as (key: MessageKey) => string;

/** The Bag tile labels drop-down, the same in Settings and the bag's own settings. */
export function tileFaceOptions(): { value: TileFace; label: string }[] {
	return TILE_FACES.map((value) => ({
		value,
		label: named(`settings.tileLabels.${value}` as MessageKey)
	}));
}

const text = (s: string): TileMark => ({ kind: 'text', text: s, name: s });

const RUNE_KEYS = new Map(TILE_RUNES.map((r) => [r.rune, r.key]));

function runes(n: number): TileMark {
	const marks = tileRunes(n);
	const name = marks.map((r) => named(RUNE_KEYS.get(r) as MessageKey)).join(' ');
	return { kind: 'text', text: marks.join(''), name };
}

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

function emoji(n: number): TileMark {
	const { item, repeat } = cycle(TILE_EMOJI, n);
	const name = named(item.key) + (repeat ? ` ${repeat}` : '');
	return { kind: 'emoji', emoji: item.emoji, name, ...(repeat ? { repeat } : {}) };
}

function colour(n: number): TileMark {
	const { item, repeat } = cycle(TILE_COLOURS, n);
	const name = named(item.key) + (repeat ? ` ${repeat}` : '');
	return {
		kind: 'colour',
		colour: item.colour,
		ink: item.ink,
		name,
		...(repeat ? { repeat } : {})
	};
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
 * one per tile (Trevor, 2026-10-31: every kind goes in). A Roman numeral that reads the same
 * as a letter ("I", "V", "X", "L") goes in once, so no two tiles ever show the same mark.
 */
function randomMarks(size: number, seed: string): TileMark[] {
	const pool: TileMark[] = [];
	const shown = new Set<string>();
	const add = (m: TileMark) => {
		if (m.kind === 'text') {
			if (shown.has(m.text)) return;
			shown.add(m.text);
		}
		pool.push(m);
	};
	for (let n = 1; n <= size; n++) {
		add(text(String(n)));
		add(text(tileLetters(n)));
		add(text(tileRoman(n)));
		add(text(tileKanji(n)));
		add(runes(n));
	}
	for (let n = 1; n <= TILE_SYMBOLS.length; n++) add(symbol(n));
	for (let n = 1; n <= TILE_COLOURS.length; n++) add(colour(n));
	for (let n = 1; n <= TILE_EMOJI.length; n++) add(emoji(n));
	return shuffle(pool, seed).slice(0, size);
}

function shuffle<T>(list: T[], seed: string): T[] {
	const random = seeded(seed);
	for (let i = list.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[list[i], list[j]] = [list[j], list[i]];
	}
	return list;
}

/** How many marks a kind has before it repeats; numbers, letters and numerals never do. */
function kindSize(face: TileFace): number {
	if (face === 'symbols') return TILE_SYMBOLS.length;
	if (face === 'colours') return TILE_COLOURS.length;
	if (face === 'emoji') return TILE_EMOJI.length;
	return 0;
}

function mark(face: TileFace, n: number): TileMark {
	if (face === 'letters') return text(tileLetters(n));
	if (face === 'roman') return text(tileRoman(n));
	if (face === 'kanji') return text(tileKanji(n));
	if (face === 'runes') return runes(n);
	if (face === 'symbols') return symbol(n);
	if (face === 'colours') return colour(n);
	if (face === 'emoji') return emoji(n);
	return text(String(n));
}

/**
 * The marks for a bag of `size` tiles, tile 1 first. `mixed` (Random label order, Trevor
 * 2026-10-20) shuffles them with `seed`: numbers 1 to `size` in another order, and symbols,
 * colours and emoji drawn from the whole kind, so colours are not always the first few of
 * the rainbow.
 */
export function tileMarks(size: number, face: TileFace, seed: string, mixed = false): TileMark[] {
	if (face === 'random') return randomMarks(size, seed);
	// None (Trevor, 2026-10-22): blank faces; the number still names a tile for screen readers.
	if (face === 'none')
		return Array.from({ length: size }, (_, i) => ({
			kind: 'text',
			text: '',
			name: String(i + 1)
		}));
	const pool = Array.from({ length: mixed ? Math.max(size, kindSize(face)) : size }, (_, i) =>
		mark(face, i + 1)
	);
	return mixed ? shuffle(pool, `${seed}:order`).slice(0, size) : pool;
}
