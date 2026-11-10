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
import { scriptToJson } from '#lib/core/data/script.ts';
import type { Character, CharacterId, CharacterName } from '#lib/core/data/index.ts';

/** One line of text as the reader found it, top to bottom. */
export interface PhotoLine {
	text: string;
	/** The line's height in the photo, in any unit: the tallest line near the top is the title. */
	height?: number;
	/** How sure the reader was of the line, 0 to 100, when it says (for the import log). */
	confidence?: number;
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
	if (!words.every((w) => /^[A-Z][a-zA-Z'’-]+$/.test(w))) return false;
	const plain = plainText(text);
	return plain.replace(/ /g, '').length >= 4 && !SHEET_WORDS.has(plain);
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
		else if (looksLikeName(text)) {
			unmatched.push(text);
			const near = nearestName(text, pool);
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
	const top = unnamed.filter(
		(l) => l.index < Math.max(3, lines.length / 4) && /[a-z]{4}/i.test(l.text)
	);
	const title = top.reduce<(typeof top)[number] | undefined>(
		(best, l) => (!best || l.height > best.height ? l : best),
		undefined
	);
	const titleText = title?.text ?? '';
	if (trace) {
		for (const t of traces) {
			// The title is told apart from the other lines that name no one.
			trace(
				title && t.index === title.index ? { index: t.index, text: t.text, outcome: 'title' } : t
			);
		}
	}
	return {
		found: [...found.values()],
		unmatched: unmatched.filter((u) => u !== titleText),
		title: titleOf(titleText),
		author
	};
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
	author = ''
): unknown[] {
	return scriptToJson({
		name,
		meta: author ? { name, author } : { name },
		characters: [...characters],
		homebrew: characters.filter((c) => !c.edition).map((c) => c.id),
		homebrewJinxes: [],
		renamedIds: {}
	});
}
