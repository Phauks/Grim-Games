/**
 * What a BotC Scripts search card shows about a script, worked out from its character ids
 * and our copy of the official characters. The site's API sends no counts or dates
 * (AdmiralGT/botc-scripts `scripts/serializers.py` VersionSerializer), so we count.
 */
import {
	CHARACTER_TYPES,
	type Character,
	type CharacterType,
	type GameData
} from '#lib/core/data/index.ts';
import type { BotcScriptsEntry } from './botcscripts-api.ts';

export interface BotcCharacter {
	id: string;
	name: string;
	type: CharacterType | undefined;
	/** One of ours, so it can be shown as a badge. */
	official?: Character;
}

export interface BotcCard {
	/** Characters by type, in the game's type order; unknown types last. */
	groups: { type: CharacterType | undefined; characters: BotcCharacter[] }[];
	counts: Partial<Record<CharacterType, number>>;
	demons: BotcCharacter[];
	/** Has a character that isn't one of the official ones. */
	homebrew: boolean;
}

/** The site strips `_` and `-` from ids and lower-cases them; so do we, to match. */
export function looseId(id: string): string {
	return id.replace(/[_-]/g, '').toLowerCase();
}

function teamType(team: string | undefined): CharacterType | undefined {
	const t = team?.toLowerCase();
	if (t === 'traveler') return 'traveller';
	return (CHARACTER_TYPES as readonly string[]).includes(t ?? '')
		? (t as CharacterType)
		: undefined;
}

const indexes = new WeakMap<GameData, Map<string, Character>>();

function index(data: GameData): Map<string, Character> {
	let map = indexes.get(data);
	if (!map) {
		map = new Map(data.characters.map((c) => [looseId(c.id), c]));
		indexes.set(data, map);
	}
	return map;
}

export function botcCard(entries: readonly BotcScriptsEntry[], data: GameData): BotcCard {
	const known = index(data);
	const seen = new Set<string>();
	const characters: BotcCharacter[] = entries.flatMap((entry) => {
		const official = known.get(looseId(entry.id));
		const character = official
			? { id: official.id, name: official.name, type: official.type, official }
			: { id: entry.id, name: entry.name ?? entry.id, type: teamType(entry.team) };
		// Scripts on the site can list a character twice, or under two spellings of one id.
		if (seen.has(character.id)) return [];
		seen.add(character.id);
		return [character];
	});
	const order = [...CHARACTER_TYPES, undefined];
	const groups = order
		.map((type) => ({ type, characters: characters.filter((c) => c.type === type) }))
		.filter((g) => g.characters.length > 0);
	const counts: Partial<Record<CharacterType, number>> = {};
	for (const c of characters) if (c.type) counts[c.type] = (counts[c.type] ?? 0) + 1;
	return {
		groups,
		counts,
		demons: characters.filter((c) => c.type === 'demon'),
		homebrew: characters.some((c) => !c.official)
	};
}
