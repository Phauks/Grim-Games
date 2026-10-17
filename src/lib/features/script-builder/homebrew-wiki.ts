/**
 * Homebrew Wiki collections for the Script builder, read through our Worker
 * (`worker/homebrew-wiki.ts`) on demand and kept in memory for the visit.
 */
import { loadScript, type Character, type GameData } from '#lib/core/data/index.ts';
import type { HomebrewEntry } from '#lib/core/rules/script-builder.ts';
import type { DraftCredit } from './draft.ts';
import {
	creditKey,
	type HomebrewCollection,
	type HomebrewCollectionAnswer
} from './homebrew-wiki-api.ts';

/** One collection's homebrew characters, ready for the picker and the draft. */
export interface HomebrewSet {
	characters: Character[];
	entries: Record<string, HomebrewEntry>;
	credits: Record<string, DraftCredit>;
}

async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(path, { headers: { Accept: 'application/json' } });
	const body: unknown = await response.json().catch(() => undefined);
	if (!response.ok) {
		const error = (body as { error?: unknown } | undefined)?.error;
		throw new Error(typeof error === 'string' ? error : `HTTP ${response.status}`);
	}
	return body as T;
}

let collections: Promise<HomebrewCollection[]> | undefined;
const sets = new Map<string, Promise<HomebrewSet>>();

export function homebrewCollections(): Promise<HomebrewCollection[]> {
	collections ??= getJson<HomebrewCollection[]>('/api/homebrew-wiki/collections').catch((e) => {
		collections = undefined;
		throw e;
	});
	return collections;
}

/** The homebrew characters a parsed script defines, with their entries as it wrote them. */
export function homebrewFromScript(
	json: readonly unknown[],
	data: GameData
): { characters: Character[]; entries: Record<string, HomebrewEntry> } {
	const { script } = loadScript(json, data);
	if (!script) return { characters: [], entries: {} };
	const homebrew = new Set(script.homebrew);
	const entries: Record<string, HomebrewEntry> = {};
	for (const entry of json) {
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
		const raw = entry as Record<string, unknown>;
		if (typeof raw.id !== 'string' || raw.id === '_meta') continue;
		const id = script.renamedIds[raw.id] ?? raw.id;
		if (homebrew.has(id)) entries[id] = { ...raw, id };
	}
	return { characters: script.characters.filter((c) => homebrew.has(c.id)), entries };
}

export function homebrewCollection(id: string, data: GameData): Promise<HomebrewSet> {
	let set = sets.get(id);
	if (!set) {
		set = getJson<HomebrewCollectionAnswer>(
			`/api/homebrew-wiki/collections/${encodeURIComponent(id)}`
		).then((answer) => {
			const { characters, entries } = homebrewFromScript(answer.script, data);
			const byName = new Map(answer.credits.map((c) => [creditKey(c.name), c]));
			const credits: Record<string, DraftCredit> = {};
			for (const c of characters) {
				const credit = byName.get(creditKey(c.name));
				if (credit) credits[c.id] = { creator: credit.creator, url: credit.url };
			}
			return { characters, entries, credits };
		});
		set.catch(() => sets.delete(id));
		sets.set(id, set);
	}
	return set;
}
