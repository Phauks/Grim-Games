/**
 * Finds character names in running text so the UI can draw them as badges (Trevor,
 * 2026-10-15: "we should always mark character names"). Names match with their capital
 * letter, so the state word "drunk" stays text while the character "Drunk" becomes a badge.
 * A plural ("Village Idiots") is one mention of the character. A name followed by
 * "reminder" or "token" names a reminder token ("a Drunk reminder"), not the character.
 */
import type { CharacterId } from '#lib/core/data/index.ts';

export interface NamedCharacter {
	id: CharacterId;
	name: string;
}

export type MentionSegment =
	{ kind: 'text'; text: string } | { kind: 'character'; characterId: CharacterId; text: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const cache = new WeakMap<
	readonly NamedCharacter[],
	{ pattern: RegExp; byName: Map<string, CharacterId> }
>();

function matcher(characters: readonly NamedCharacter[]) {
	let found = cache.get(characters);
	if (!found) {
		const byName = new Map(characters.map((c) => [c.name, c.id]));
		// Longest first, so "Scarlet Woman" wins over any shorter name inside it.
		const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(escape);
		const pattern = new RegExp(
			`(?<![\\p{L}\\p{N}])(${names.join('|')})(s?)(?![\\p{L}\\p{N}])(?!\\s+(?:reminders?|tokens?)\\b)`,
			'gu'
		);
		found = { pattern, byName };
		cache.set(characters, found);
	}
	return found;
}

export function mentionSegments(
	text: string,
	characters: readonly NamedCharacter[]
): MentionSegment[] {
	if (characters.length === 0 || !text) return text ? [{ kind: 'text', text }] : [];
	const { pattern, byName } = matcher(characters);
	const out: MentionSegment[] = [];
	let at = 0;
	for (const match of text.matchAll(pattern)) {
		if (match.index > at) out.push({ kind: 'text', text: text.slice(at, match.index) });
		out.push({ kind: 'character', characterId: byName.get(match[1])!, text: match[0] });
		at = match.index + match[0].length;
	}
	if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
	return out;
}
