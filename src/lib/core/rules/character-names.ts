/**
 * Finds character names in our own and TPI's text, so the UI can always draw them as
 * character badges (Trevor, 2026-10-15: "we should always mark character names").
 *
 * A name matches as a whole word, with its own capitals ("King", never "king", "Kings" or
 * "Seeking"), longest name first ("Fortune Teller" before any shorter name inside it). A
 * possessive still matches ("the Spy's" is the Spy). Straight and curly apostrophes are the
 * same ("Lil’ Monsta").
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';

export type NamePiece = { kind: 'text'; text: string } | { kind: 'character'; id: CharacterId };

export interface CharacterNames {
	/** Splits `text` into plain text and character names. */
	split(text: string): NamePiece[];
	/** The character with exactly this name (any case, either apostrophe). */
	byName(name: string): CharacterId | undefined;
}

const fold = (s: string) => s.replace(/’/g, "'").trim().toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches no name at all, for when no character data is at hand. */
export const NO_CHARACTER_NAMES: CharacterNames = {
	split: (text) => (text ? [{ kind: 'text', text }] : []),
	byName: () => undefined
};

export function characterNames(
	characters: readonly Pick<Character, 'id' | 'name'>[]
): CharacterNames {
	const ids = new Map<string, CharacterId>();
	const exact = new Map<string, CharacterId>();
	for (const c of characters) {
		if (!c.name) continue;
		if (!ids.has(fold(c.name))) ids.set(fold(c.name), c.id);
		exact.set(c.name.replace(/’/g, "'"), c.id);
	}
	const names = [...exact.keys()].sort((a, b) => b.length - a.length);
	if (names.length === 0) return NO_CHARACTER_NAMES;
	const alternatives = names.map((n) => escape(n).replace(/'/g, "['’]"));
	const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'gu');

	return {
		split(text) {
			const out: NamePiece[] = [];
			let at = 0;
			for (const match of text.matchAll(pattern)) {
				const id = exact.get(match[0].replace(/’/g, "'"));
				if (id === undefined) continue;
				if (match.index > at) out.push({ kind: 'text', text: text.slice(at, match.index) });
				out.push({ kind: 'character', id });
				at = match.index + match[0].length;
			}
			if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
			return out;
		},
		byName: (name) => ids.get(fold(name))
	};
}
