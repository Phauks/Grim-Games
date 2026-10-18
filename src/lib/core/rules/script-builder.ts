/**
 * Building a script (the Script builder page, Trevor 2026-10-16): official characters by id,
 * and homebrew characters (from the BotC Homebrew Wiki, 2026-10-17) as the full objects their
 * source wrote, unchanged.
 *
 * Order: TPI's Sort Order (`sortByStandardOrder`), as on official scripts. Output is TPI's
 * script format, so it loads, saves and shares like any other script.
 */
import type { GameData } from '#lib/core/data/game-data.ts';
import { sortByStandardOrder } from '#lib/core/data/sort-order.ts';
import {
	CHARACTER_TYPES,
	type CharacterId,
	type CharacterType,
	type ScriptMeta
} from '#lib/core/data/types.ts';
import type { TypeCounts } from './distribution.ts';

/** A homebrew character in TPI's script format (`id`, `name`, `team`, `ability`, ...). */
export type HomebrewEntry = Readonly<Record<string, unknown>>;
export type HomebrewEntries = Readonly<Record<CharacterId, HomebrewEntry>>;

interface Sortable {
	id: CharacterId;
	type: CharacterType;
	ability: string;
	name: string;
}

function homebrewSortable(id: CharacterId, entry: HomebrewEntry): Sortable | undefined {
	const type = CHARACTER_TYPES.find((t) => t === entry.team);
	if (!type) return undefined;
	const text = (value: unknown) => (typeof value === 'string' ? value : '');
	return { id, type, ability: text(entry.ability), name: text(entry.name) };
}

/**
 * The ids in TPI's Sort Order. Homebrew entries win over official characters with the same
 * id (as when a script overrides one); unknown ids and repeats are left out.
 */
export function scriptOrder(
	ids: Iterable<CharacterId>,
	data: GameData,
	homebrew: HomebrewEntries = {}
): CharacterId[] {
	const characters = [...new Set(ids)].flatMap((id): Sortable[] => {
		const entry = Object.hasOwn(homebrew, id) ? homebrew[id] : undefined;
		const sortable = entry ? homebrewSortable(id, entry) : data.byId.get(id);
		return sortable ? [sortable] : [];
	});
	return sortByStandardOrder(characters).map((c) => c.id);
}

export interface BuiltScriptDetails {
	name: string;
	author: string;
	/** The script's version, such as "1.2"; left out of `_meta` when empty. */
	version?: string;
}

/**
 * The script in TPI's format: `_meta` (name, and author and version when given), then the
 * characters.
 */
export function builtScriptJson(
	ids: Iterable<CharacterId>,
	details: BuiltScriptDetails,
	data: GameData,
	homebrew: HomebrewEntries = {}
): unknown[] {
	const meta: { id: '_meta' } & Partial<ScriptMeta> = { id: '_meta', name: details.name.trim() };
	const author = details.author.trim();
	if (author) meta.author = author;
	const version = details.version?.trim();
	if (version) meta.version = version;
	return [
		meta,
		...scriptOrder(ids, data, homebrew).map((id) =>
			Object.hasOwn(homebrew, id) ? { ...homebrew[id], id } : id
		)
	];
}

/** A full script, or a Teensyville one for 5 or 6 players. */
export type ScriptSize = 'full' | 'teensyville';

/**
 * How many of each type a script usually has, shown beside the builder's counts as a guide,
 * never a limit (Trevor, 2026-10-18). Full: 13, 4, 4, 4, as TPI's "Behind the Curtain #6"
 * gives for a full script. Teensyville: 6, 2, 2, 2, from the BotC wiki's Teensyville page
 * (TPI's same post says 1 Demon; the wiki is our rules authority).
 */
export const EXPECTED_SCRIPT_COUNTS: Readonly<Record<ScriptSize, Readonly<TypeCounts>>> = {
	full: { townsfolk: 13, outsider: 4, minion: 4, demon: 4 },
	teensyville: { townsfolk: 6, outsider: 2, minion: 2, demon: 2 }
};
