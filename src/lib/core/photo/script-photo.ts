/**
 * A script read from a photo of its printed sheet (plan M54, Trevor 2026-11-05: "take a
 * picture of a script ... suddenly it's all loaded in the app"). The phone's text reader
 * hands over the lines it read; this turns them into characters. Only names the app knows
 * can come out: a misread line becomes a close match to check, or a line the user names
 * themselves, never an invented character.
 *
 * A line is a name when one of its first few words reads like a character's name (edit
 * distance, forgiving case, accents and punctuation), or when it carries most of a
 * character's ability text, which every printed script shows beside the name. The script is
 * named by the sheet's title, never matched to a known script (Trevor, 2026-11-10: a sheet
 * may differ slightly from it).
 */
import { normaliseCharacterId } from '#lib/core/data/parse.ts';
import { scriptToJson } from '#lib/core/data/script.ts';
import type {
	Character,
	CharacterId,
	CharacterName,
	CharacterType,
	NightMarker
} from '#lib/core/data/index.ts';

/** One line of text as the reader found it, top to bottom. */
export interface PhotoLine {
	text: string;
	/** The line's height in the photo, in any unit: the tallest line near the top is the title. */
	height?: number;
	/** How sure the reader was of the line, 0 to 100, when it says (for the import log). */
	confidence?: number;
	/** Where the line sits in the picture read, in its pixels, to mark it there. */
	box?: LineBox;
}

/** A line's corners in a picture, in its pixels. */
export interface LineBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export type PhotoMatchKind = 'matched' | 'close';

/** A character found on the sheet, with the line that named it. */
export interface PhotoFound {
	character: Character;
	kind: PhotoMatchKind;
	/** The words as read. */
	read: string;
}

/** What a photo's lines came to. */
export interface PhotoReading {
	/** In the order the sheet lists them, each character once. */
	found: PhotoFound[];
	/** Lines that look like a character's name but match none the app knows. */
	unmatched: string[];
	/** The sheet's title as read; '' when none was found. */
	title: string;
	/** The script's author, from a "By: name" line (Trevor, 2026-11-06); '' when there is none. */
	author: string;
	/**
	 * Characters the sheet lists that the app doesn't know, as new custom characters: each name
	 * with the ability printed beside it, and its type from the heading above it or the known
	 * characters around it. Only used when the review's Custom characters switch is on
	 * (Trevor, 2026-11-14, picked A).
	 */
	customs: PhotoCustom[];
	/** The lines of `unmatched` the customs and the night order account for. */
	customReads: string[];
	/**
	 * The sheet's own night order, when it prints one under "First night" and "Other nights"
	 * headings (Trevor, 2026-11-14): character ids, custom ones included, and night steps.
	 */
	night?: PhotoNight;
}

/** A character the app doesn't know, read off the sheet. */
export interface PhotoCustom {
	character: Character;
	/** The name as read. */
	read: string;
}

/** A night order read off a sheet, each list in the sheet's order. */
export interface PhotoNight {
	first: (CharacterId | NightMarker)[];
	other: (CharacterId | NightMarker)[];
}

/** How one line was read, for the import log (Trevor, 2026-11-06: "more verbose logging"). */
export type PhotoLineTrace =
	| { index: number; text: string; outcome: 'empty' | 'tail' | 'title' | 'unnamed' }
	| { index: number; text: string; outcome: 'author'; author: string }
	| {
			index: number;
			text: string;
			outcome: 'unmatched';
			nearest?: { name: CharacterName; score: number };
	  }
	| {
			index: number;
			text: string;
			outcome: 'name' | 'ability' | 'close';
			name: CharacterName;
			/** Name likeness (0 to 1) for a name or close match, the ability's share for an ability. */
			score: number;
	  };

/**
 * A sheet's byline, "By: name" or "By name" (script makers print one under the title),
 * and the name it gives. Only a short line counts, so an ability that starts "By" never does.
 */
export function bylineAuthor(text: string): string | undefined {
	const match = /^by\s*[:.-]?\s+(.+)$/i.exec(text.trim());
	const author = match?.[1].trim().replace(/[.,;]+$/, '');
	return author && author.split(/\s+/).length <= 6 && /[a-z]/i.test(author) ? author : undefined;
}

/** A name at least this alike (0 to 1) is found outright. */
const MATCHED = 0.86;
/** At least this alike, and it is a close match for the user to check. */
const CLOSE = 0.7;
/** The share of an ability's words a line must carry to name its character. */
const ABILITY_SHARE = 0.6;
/** Abilities this short say too little to pick one character by. */
const ABILITY_MIN_WORDS = 5;
/** Longest name, in words, looked for at the start of a line. */
const NAME_WORDS = 3;

/** Lower case, no accents, letters and digits only, single spaces. */
export function plainText(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/['’`]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Levenshtein distance between two strings. */
function distance(a: string, b: string): number {
	if (a === b) return 0;
	if (!a.length) return b.length;
	if (!b.length) return a.length;
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
		}
		previous = current;
	}
	return previous[b.length];
}

/** How alike two plain strings are, 0 to 1. Spaces don't count: "Raven keeper" is "Ravenkeeper". */
export function likeness(a: string, b: string): number {
	const x = a.replace(/ /g, '');
	const y = b.replace(/ /g, '');
	const longest = Math.max(x.length, y.length);
	return longest === 0 ? 0 : 1 - distance(x, y) / longest;
}

/** Words that say nothing about which ability a line is. */
const COMMON = new Set(
	'the and you are they that this with from your their them have has for not but one was its each who any all can'.split(
		' '
	)
);

function contentWords(text: string): string[] {
	return plainText(text)
		.split(' ')
		.filter((w) => w.length >= 3 && !COMMON.has(w));
}

/** Words a sheet prints that are never a character's name. */
const SHEET_WORDS = new Set([
	'townsfolk',
	'outsider',
	'outsiders',
	'minion',
	'minions',
	'demon',
	'demons',
	'traveller',
	'travellers',
	'fabled',
	'loric',
	'jinx',
	'jinxes',
	'first night',
	'other nights',
	'other night',
	'dawn',
	'dusk',
	'minion info',
	'demon info'
]);

/** Type headings a sheet prints, and the character type each starts. */
const TYPE_HEADINGS: Record<string, CharacterType> = {
	townsfolk: 'townsfolk',
	outsider: 'outsider',
	outsiders: 'outsider',
	minion: 'minion',
	minions: 'minion',
	demon: 'demon',
	demons: 'demon',
	traveller: 'traveller',
	travellers: 'traveller',
	traveler: 'traveller',
	travelers: 'traveller',
	fabled: 'fabled',
	loric: 'loric'
};

/** Night steps a printed night order names beside the characters. */
const NIGHT_STEPS: Record<string, NightMarker> = {
	dusk: 'dusk',
	dawn: 'dawn',
	'minion info': 'minioninfo',
	'demon info': 'demoninfo'
};

/** A title is at most this many words. */
const TITLE_WORDS = 8;
/** A night order's lines are a name or a step: a longer line carries an ability. */
const NIGHT_WORDS = 4;
/** A night order with fewer steps than this is a stray heading, not a list. */
const NIGHT_MIN = 2;

interface Candidate {
	character: Character;
	name: string;
	abilityWords: string[];
}

function candidates(characters: readonly Character[]): Candidate[] {
	return characters.map((character) => ({
		character,
		name: plainText(character.name),
		abilityWords: [...new Set(contentWords(character.ability))]
	}));
}

/** The best name match among the first words of a line, if any is at least close. */
function nameMatch(
	line: string,
	pool: readonly Candidate[]
): { candidate: Candidate; score: number; read: string } | undefined {
	const best = nearestName(line, pool);
	return best && best.score >= CLOSE ? best : undefined;
}

/** The most alike name among the first words of a line, however unalike. */
function nearestName(
	line: string,
	pool: readonly Candidate[]
): { candidate: Candidate; score: number; read: string } | undefined {
	const words = plainText(line).split(' ').filter(Boolean);
	// The icon beside a name reads as a stray letter or two ("B Empath", "3 Chef").
	while (words.length > 1 && (words[0].length <= 2 || !/[a-z]/.test(words[0]))) words.shift();
	let best: { candidate: Candidate; score: number; read: string } | undefined;
	for (let n = 1; n <= Math.min(NAME_WORDS, words.length); n++) {
		const read = words.slice(0, n).join(' ');
		if (read.replace(/ /g, '').length < 3) continue;
		for (const candidate of pool) {
			const score = likeness(read, candidate.name);
			if (!best || score > best.score) best = { candidate, score, read };
		}
	}
	return best;
}

/** The character whose ability the line carries most of, if it carries enough, and how much. */
function abilityMatch(
	line: string,
	pool: readonly Candidate[]
): { candidate: Candidate; share: number } | undefined {
	const words = new Set(contentWords(line));
	if (words.size < ABILITY_MIN_WORDS) return undefined;
	let best: { candidate: Candidate; share: number } | undefined;
	let second = 0;
	for (const candidate of pool) {
		if (candidate.abilityWords.length < ABILITY_MIN_WORDS) continue;
		const carried = candidate.abilityWords.filter((w) => words.has(w)).length;
		if (carried < ABILITY_MIN_WORDS) continue;
		const share = carried / candidate.abilityWords.length;
		if (!best || share > best.share) {
			second = best?.share ?? 0;
			best = { candidate, share };
		} else if (share > second) second = share;
	}
	// A near tie between two abilities names neither.
	return best && best.share >= ABILITY_SHARE && best.share - second >= 0.15 ? best : undefined;
}

function named(candidate: Candidate, score: number) {
	return { name: candidate.character.name, score };
}

/** A line that reads like a name the app doesn't know: one to three capitalised words. */
function looksLikeName(text: string): boolean {
	const words = text.trim().split(/\s+/);
	if (words.length < 1 || words.length > NAME_WORDS) return false;
	if (!words.every((w) => NAME_WORD.test(w))) return false;
	const plain = plainText(text);
	return plain.replace(/ /g, '').length >= 4 && !SHEET_WORDS.has(plain);
}

const NAME_WORD = /^[A-Z][a-zA-Z'’-]+$/;

/** The words abilities start with ("Each", "You", "If"), to tell where a name ends on its line. */
function abilityOpeners(characters: readonly Character[]): Set<string> {
	return new Set(
		characters.map((c) => plainText(c.ability).split(' ')[0]).filter((w) => w.length > 1)
	);
}

/**
 * A name the app doesn't know and its ability read as one line ("Lamplighter Each night,
 * choose a player: ..."): one to three capitalised words, then a capitalised word an ability
 * starts with (`openers`, the first words of the known abilities), then the ability.
 */
function nameAndAbility(
	text: string,
	openers: ReadonlySet<string>
): { name: string; ability: string } | undefined {
	const words = text.trim().split(/\s+/);
	for (let n = 1; n <= Math.min(NAME_WORDS, words.length - 5); n++) {
		if (!NAME_WORD.test(words[n - 1])) return undefined;
		const next = words[n];
		if (!/^[A-Z]/.test(next) || !openers.has(plainText(next))) continue;
		const name = words.slice(0, n).join(' ');
		if (!looksLikeName(name)) return undefined;
		return { name, ability: words.slice(n).join(' ') };
	}
	return undefined;
}

/**
 * Reads the characters from a sheet's lines. `characters` are the ones a line may become
 * (the official characters, and any custom ones the user already has).
 */
export function readScriptLines(
	lines: readonly PhotoLine[],
	characters: readonly Character[],
	/** Hears how each line was read, in order (the import log). */
	trace?: (line: PhotoLineTrace) => void
): PhotoReading {
	const pool = candidates(characters);
	const openers = abilityOpeners(characters);
	const found = new Map<CharacterId, PhotoFound>();
	const unmatched: string[] = [];
	const unnamed: { text: string; height: number; index: number }[] = [];

	const add = (character: Character, kind: PhotoMatchKind, read: string) => {
		const had = found.get(character.id);
		if (!had) found.set(character.id, { character, kind, read });
		else if (had.kind === 'close' && kind === 'matched') had.kind = 'matched';
	};

	const traces: PhotoLineTrace[] = [];
	let author = '';
	lines.forEach((line, index) => {
		const text = line.text.trim();
		if (!text) {
			traces.push({ index, text, outcome: 'empty' });
			return;
		}
		// The first byline names the author; it is never the title or a character.
		const by = author ? undefined : bylineAuthor(text);
		if (by) {
			author = by;
			traces.push({ index, text, outcome: 'author', author: by });
			return;
		}
		// The end of an ability that ran onto a line of its own ("poisoned.") names no one.
		const tail = /[.)\]]$/.test(text) && text.split(/\s+/).length <= 2;
		const name = tail ? undefined : nameMatch(text, pool);
		const ability = abilityMatch(text, pool);
		if (name && name.score >= MATCHED) {
			add(name.candidate.character, 'matched', name.read);
			traces.push({ index, text, outcome: 'name', ...named(name.candidate, name.score) });
			return;
		}
		if (ability) {
			// The ability confirms a close name, or names the character on its own.
			const { candidate } = ability;
			add(candidate.character, 'matched', name?.candidate === candidate ? name.read : text);
			traces.push({ index, text, outcome: 'ability', ...named(candidate, ability.share) });
			return;
		}
		if (name) {
			add(name.candidate.character, 'close', name.read);
			traces.push({ index, text, outcome: 'close', ...named(name.candidate, name.score) });
			return;
		}
		if (tail) traces.push({ index, text, outcome: 'tail' });
		else if (looksLikeName(text) || nameAndAbility(text, openers)) {
			// A name the app doesn't know, alone or with its ability on the line.
			const read = nameAndAbility(text, openers)?.name ?? text;
			unmatched.push(read);
			const near = nearestName(read, pool);
			traces.push({
				index,
				text,
				outcome: 'unmatched',
				nearest: near && { name: near.candidate.character.name, score: near.score }
			});
		} else traces.push({ index, text, outcome: 'unnamed' });
		unnamed.push({ text, height: line.height ?? 0, index });
	});

	// The title: the tallest line that names no character, among the sheet's first lines.
	// A long line (a character the app doesn't know, with its ability) or a heading is no title.
	const top = unnamed.filter(
		(l) =>
			l.index < Math.max(3, lines.length / 4) &&
			/[a-z]{4}/i.test(l.text) &&
			l.text.split(/\s+/).length <= TITLE_WORDS &&
			!SHEET_WORDS.has(plainText(l.text))
	);
	const title = top.reduce<(typeof top)[number] | undefined>(
		(best, l) => (!best || l.height > best.height ? l : best),
		undefined
	);
	const titleText = title?.text ?? '';
	// The title is told apart from the other lines that name no one.
	const told = traces.map((t): PhotoLineTrace =>
		title && t.index === title.index ? { index: t.index, text: t.text, outcome: 'title' } : t
	);
	if (trace) for (const t of told) trace(t);
	return {
		found: [...found.values()],
		unmatched: unmatched.filter((u) => u !== titleText),
		title: titleOf(titleText),
		author,
		...sheetExtras(told, characters, pool, openers)
	};
}

/** A custom character being read: its name, and its ability as the lines after it add to it. */
interface Reading {
	name: string;
	ability: string[];
	/** The heading above it, if the sheet prints one. */
	type?: CharacterType;
	/** Where it was read, to find the known characters around it. */
	index: number;
}

/**
 * The second look at a sheet's lines: the names the app doesn't know, with the ability lines
 * under each, as custom characters; and the night order, when the sheet prints one. A night
 * heading starts a list of names and night steps that ends at a type heading or a longer line,
 * which carries an ability (a sheet that prints its night order beside the characters).
 */
function sheetExtras(
	traces: readonly PhotoLineTrace[],
	characters: readonly Character[],
	pool: readonly Candidate[],
	openers: ReadonlySet<string>
): Pick<PhotoReading, 'customs' | 'customReads' | 'night'> {
	const byName = new Map(characters.map((c) => [c.name, c]));
	const reads: Reading[] = [];
	/** Each known character's type, by where it was read. */
	const known: { index: number; type: CharacterType }[] = [];
	const night: PhotoNight = { first: [], other: [] };
	const used: string[] = [];
	let section: CharacterType | undefined;
	let list: (CharacterId | NightMarker)[] | undefined;
	let current: Reading | undefined;

	for (const t of traces) {
		const plain = plainText(t.text);
		if (TYPE_HEADINGS[plain]) {
			section = TYPE_HEADINGS[plain];
			list = current = undefined;
			continue;
		}
		if (/^first nights?\b/.test(plain) || /^other nights?\b/.test(plain)) {
			list = plain.startsWith('first') ? night.first : night.other;
			current = undefined;
			continue;
		}
		if (list && t.outcome !== 'ability' && t.text.split(/\s+/).length <= NIGHT_WORDS) {
			// A step of the night order: a known character, one read above, or a night step.
			const custom = reads.find((r) => likeness(plainText(r.name), plain) >= MATCHED);
			const entry =
				NIGHT_STEPS[plain] ??
				(custom ? customId(custom.name) : undefined) ??
				('name' in t ? byName.get(t.name)?.id : undefined);
			if (entry && !list.includes(entry)) list.push(entry);
			if (t.outcome === 'unmatched' && !used.includes(t.text)) used.push(t.text);
			continue;
		}
		list = undefined;
		if ('name' in t) {
			const type = byName.get(t.name)?.type;
			if (type) known.push({ index: t.index, type });
			current = undefined;
		} else if (t.outcome === 'unmatched') {
			const both = nameAndAbility(t.text, openers);
			const name = both?.name ?? t.text;
			const ability = both ? [both.ability] : [];
			reads.push((current = { name, ability, type: section, index: t.index }));
			used.push(name);
		} else if (t.outcome === 'unnamed' || t.outcome === 'tail') current?.ability.push(t.text);
		else current = undefined;
	}

	const typeAt = (index: number): CharacterType =>
		known.findLast((k) => k.index < index)?.type ??
		known.find((k) => k.index > index)?.type ??
		'townsfolk';
	const ids = new Set(pool.map((p) => p.character.id));
	const customs: PhotoCustom[] = [];
	for (const r of reads) {
		const id = customId(r.name);
		if (!id || ids.has(id)) continue;
		ids.add(id);
		const ability = r.ability.join(' ').replace(/\s+/g, ' ').trim();
		customs.push({
			read: r.name,
			character: {
				id,
				name: r.name,
				type: r.type ?? typeAt(r.index),
				ability,
				setup: /\[[^\]]+\]/.test(ability),
				reminders: [],
				remindersGlobal: [],
				special: []
			}
		});
	}
	const keep = (steps: (CharacterId | NightMarker)[]) =>
		steps.filter((s) => s.length > 0 && (s in NIGHT_IDS || ids.has(s)));
	const first = keep(night.first);
	const other = keep(night.other);
	return {
		customs,
		customReads: used,
		...(first.length >= NIGHT_MIN || other.length >= NIGHT_MIN
			? {
					night: {
						first: first.length >= NIGHT_MIN ? first : [],
						other: other.length >= NIGHT_MIN ? other : []
					}
				}
			: {})
	};
}

const NIGHT_IDS: Record<string, true> = Object.fromEntries(
	Object.values(NIGHT_STEPS).map((id) => [id, true])
);

/** The id a custom character read off a sheet takes: its name, as TPI's ids are written. */
function customId(name: string): CharacterId {
	return normaliseCharacterId(name) as CharacterId;
}

const letterCount = (text: string) => text.replace(/[^\p{L}]/gu, '').length;

/**
 * A title line cleaned of what the reader picks up beside it: a printed rule running from the
 * title to a type heading reads as dashes ("—Kingfishing———— (ww", Trevor's sheet,
 * 2026-11-10), so the part with the most letters between runs of rule characters is kept, a
 * type heading in it is dropped, and stray marks at its ends are trimmed.
 */
export function titleOf(text: string): string {
	const parts = text.split(/[-–—_=~.·•|]{3,}/);
	const best = parts.reduce((a, b) => (letterCount(b) > letterCount(a) ? b : a), '');
	return best
		.replace(/\b(townsfolk|outsiders?|minions?|demons?|travell?ers?|fabled)\b/gi, ' ')
		.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}!?)'’]+$/gu, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * The script JSON for what the review kept, to load as a new script: official characters by
 * id, a custom one (from the user's own scripts) written out in full as script JSON, so the
 * loader keeps it with its ability (Trevor, 2026-11-06: characters loaded without one).
 */
export function photoScriptJson(
	name: string,
	characters: readonly Character[],
	author = '',
	version = '',
	/** The sheet's own night order, kept as the script's (`_meta.firstNight`, `otherNight`). */
	night?: PhotoNight
): unknown[] {
	const kept = new Set<string>(characters.map((c) => c.id));
	const order = (steps: readonly string[] = []) => {
		const on = steps.filter((s) => kept.has(s) || s in NIGHT_IDS);
		return on.some((s) => kept.has(s)) ? on : undefined;
	};
	const firstNight = order(night?.first);
	const otherNight = order(night?.other);
	return scriptToJson({
		name,
		meta: {
			name,
			...(author && { author }),
			...(version && { version }),
			...(firstNight && { firstNight }),
			...(otherNight && { otherNight })
		},
		characters: [...characters],
		homebrew: characters.filter((c) => !c.edition).map((c) => c.id),
		homebrewJinxes: [],
		renamedIds: {}
	});
}
