/**
 * Building a script from official characters (the Script builder page, Trevor 2026-10-16).
 *
 * Order: TPI's Sort Order (`sortByStandardOrder`), as on official scripts. Output is TPI's
 * script format, so it loads, saves and shares like any other script.
 */
import type { GameData } from '#lib/core/data/game-data.ts';
import { sortByStandardOrder } from '#lib/core/data/sort-order.ts';
import type { CharacterId, ScriptMeta } from '#lib/core/data/types.ts';

/** The ids in TPI's Sort Order; unknown ids and repeats are left out. */
export function scriptOrder(ids: Iterable<CharacterId>, data: GameData): CharacterId[] {
	const characters = [...new Set(ids)].flatMap((id) => data.byId.get(id) ?? []);
	return sortByStandardOrder(characters).map((c) => c.id);
}

export interface BuiltScriptDetails {
	name: string;
	author: string;
}

/** The script in TPI's format: `_meta` (name and author, when given), then ids in order. */
export function builtScriptJson(
	ids: Iterable<CharacterId>,
	details: BuiltScriptDetails,
	data: GameData
): unknown[] {
	const meta: { id: '_meta' } & Partial<ScriptMeta> = { id: '_meta', name: details.name.trim() };
	const author = details.author.trim();
	if (author) meta.author = author;
	return [meta, ...scriptOrder(ids, data)];
}
