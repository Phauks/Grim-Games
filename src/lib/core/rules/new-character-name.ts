/**
 * A name for a new custom character (Trevor, 2026-11-12: "random character names when making
 * new custom characters, so that they don't all overlap"): two word parts of our own, such as
 * Mothbinder or Saltwarden, so every new character starts with a name and an id made from it.
 * No pair is an official character's name (`new-character-name.test.ts`).
 */
const FIRST = [
	'Ash',
	'Bell',
	'Briar',
	'Candle',
	'Cinder',
	'Dusk',
	'Ember',
	'Fog',
	'Frost',
	'Gloam',
	'Hollow',
	'Lamp',
	'Lantern',
	'Mire',
	'Moth',
	'Owl',
	'Quill',
	'Rook',
	'Rust',
	'Salt',
	'Thorn',
	'Wick',
	'Willow'
] as const;

const SECOND = [
	'binder',
	'caller',
	'finder',
	'keeper',
	'maker',
	'monger',
	'runner',
	'seeker',
	'singer',
	'smith',
	'teller',
	'walker',
	'ward',
	'warden',
	'watcher',
	'weaver',
	'wright'
] as const;

/** Every name it can give. */
export const CHARACTER_NAME_POOL: readonly string[] = FIRST.flatMap((a) =>
	SECOND.map((b) => `${a}${b}`)
);

/**
 * A random name from the pool that none of `taken` has (any case), or, when all are taken,
 * one with a number after it.
 */
export function randomCharacterName(
	taken: Iterable<string> = [],
	random: () => number = Math.random
): string {
	const used = new Set([...taken].map((n) => n.trim().toLowerCase()));
	const free = CHARACTER_NAME_POOL.filter((n) => !used.has(n.toLowerCase()));
	const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;
	if (free.length) return pick(free);
	const base = pick(CHARACTER_NAME_POOL);
	let n = 2;
	while (used.has(`${base} ${n}`.toLowerCase())) n++;
	return `${base} ${n}`;
}

/** Whether `name` is one this gives, so a new character with only it is still empty. */
export function isGivenName(name: string): boolean {
	const base = name.trim().replace(/ \d+$/, '');
	return CHARACTER_NAME_POOL.includes(base);
}
