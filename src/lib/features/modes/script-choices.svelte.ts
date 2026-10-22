/**
 * Scripts a game mode can be played with, chosen the same way as on New game's Standard tab:
 * the official editions, the script last played from Search, and recent custom scripts. A
 * mode with its own scripts (Two Towns) loads them from their links instead.
 */
import {
	editionScript,
	loadScript,
	OFFICIAL_EDITIONS,
	type GameData,
	type LoadedScript,
	type Script
} from '#lib/core/data/index.ts';
import type { SourceLink } from '#lib/core/modes/index.ts';
import { fetchLinkTarget } from '#lib/features/scripts/fetch-script.ts';
import { resolveLink } from '#lib/features/scripts/script-links.ts';
import {
	QUICK_PLAY_ID,
	quickPlayScript,
	recentScripts
} from '#lib/features/scripts/current-script.svelte.ts';
import { profileScripts } from '#lib/features/account/profile-scripts.svelte.ts';
import {
	reloadSavedScript,
	sameScript,
	type SavedScript,
	type ScriptSource
} from '#lib/features/scripts/saved-scripts.ts';
import { scriptVersion } from '#lib/features/player/player-script.ts';

export type ScriptChoice = string;

export interface ScriptChoiceOption {
	value: ScriptChoice;
	label: string;
	/** Shown under the name with the version (Trevor, 2026-10-18), when the script says. */
	author?: string;
	version?: string;
	/** The heading it is listed under in the script search. */
	group?: 'recent' | 'library';
	/** Where the saved script came from; undefined for the base three. */
	source?: ScriptSource;
	/** The saved script in TPI's format; undefined for the base three. */
	json?: unknown[];
}

function savedMeta(saved: Pick<SavedScript, 'json'>) {
	return saved.json.find(
		(e): e is { id: string; author?: unknown; version?: unknown } =>
			typeof e === 'object' && e !== null && (e as { id?: unknown }).id === '_meta'
	);
}

/** The author a saved script's own `_meta` names, if any. */
function savedAuthor(saved: Pick<SavedScript, 'json'>): string | undefined {
	const meta = savedMeta(saved);
	return typeof meta?.author === 'string' && meta.author.trim() ? meta.author : undefined;
}

/** Its BotC Scripts version, or else the version its own `_meta` names. */
function savedVersion(saved: Pick<SavedScript, 'json' | 'source'>): string | undefined {
	const version = savedMeta(saved)?.version;
	return scriptVersion(saved, typeof version === 'string' ? { version } : undefined);
}

function savedOption(saved: SavedScript, value: ScriptChoice): ScriptChoiceOption {
	const author = savedAuthor(saved);
	const version = savedVersion(saved);
	return {
		value,
		label: saved.name,
		...(author ? { author } : {}),
		...(version ? { version } : {}),
		source: saved.source,
		json: saved.json
	};
}

export function scriptChoices(): ScriptChoiceOption[] {
	const quick = quickPlayScript.saved;
	return [
		...OFFICIAL_EDITIONS.map((e) => ({ value: e.id as string, label: e.name })),
		...(quick ? [savedOption(quick, `recent:${QUICK_PLAY_ID}`)] : []),
		...recentScripts.list
			.filter((s) => !s.edition)
			.slice(0, 3)
			.map((s) => savedOption(s, `recent:${s.scriptId}`))
	];
}

/**
 * Every script the search on New game offers (Trevor, 2026-10-19: easy to reach with 50
 * scripts): the recent ones, most recently used first, then the rest of the account's
 * Library. The base three are chips beside it, so they are left out.
 */
export function searchableScripts(): ScriptChoiceOption[] {
	const quick = quickPlayScript.saved;
	const recent = [...(quick ? [quick] : []), ...recentScripts.list.filter((s) => !s.edition)];
	return [
		...recent.map((s) => ({ ...savedOption(s, `recent:${s.scriptId}`), group: 'recent' as const })),
		...profileScripts.list
			.filter((entry) => !recent.some((s) => sameScript(s, { json: entry.script.json })))
			.map((entry) => {
				const author = savedAuthor(entry.script);
				const version = savedVersion(entry.script);
				return {
					value: `profile:${entry.id}`,
					label: entry.script.name,
					...(author ? { author } : {}),
					...(version ? { version } : {}),
					group: 'library' as const,
					source: entry.script.source,
					json: entry.script.json
				};
			})
	];
}

/** The character ids a script in TPI's format lists, in order. */
function jsonIds(json: readonly unknown[]): string[] {
	return json.flatMap((e) => {
		const id = typeof e === 'string' ? e : (e as { id?: unknown } | null)?.id;
		return typeof id === 'string' && id !== '_meta' ? [id] : [];
	});
}

/**
 * The saved script a game's script was started from (Trevor, backlog L14: Game info links
 * the script to its source page): one of the recent or Library scripts with its name and
 * author, preferring the one with its version, then the one with its characters. Undefined
 * when none matches.
 */
export function savedChoiceFor(script: Script): ScriptChoiceOption | undefined {
	const name = script.meta?.name?.trim();
	if (!name) return undefined;
	const author = script.meta?.author?.trim() || undefined;
	const version = script.meta?.version?.trim() || undefined;
	const named = searchableScripts().filter((o) => o.label === name && o.author === author);
	const ids = script.entries.map((e) => (e.kind === 'official' ? e.id : e.character.id)).join(',');
	return (
		(version && named.find((o) => o.version === version)) ||
		named.find((o) => o.json && jsonIds(o.json).join(',') === ids) ||
		named[0]
	);
}

export function loadScriptChoice(choice: ScriptChoice, data: GameData): LoadedScript {
	const quick = quickPlayScript.saved;
	const recent = choice.startsWith('recent:')
		? [...(quick ? [quick] : []), ...recentScripts.list].find(
				(s) => `recent:${s.scriptId}` === choice
			)
		: undefined;
	const profile = choice.startsWith('profile:')
		? profileScripts.list.find((entry) => `profile:${entry.id}` === choice)
		: undefined;
	const loaded = recent
		? reloadSavedScript(recent, data)
		: profile
			? loadScript(profile.script.json, data).script
			: editionScript(choice, data);
	if (!loaded) throw new Error('the chosen script could not be loaded');
	return loaded;
}

/** A mode's own script, from its link (BotC Scripts through our Worker). */
export async function loadLinkedScript(link: SourceLink, data: GameData): Promise<LoadedScript> {
	const fetched = await fetchLinkTarget(resolveLink(link.url), link.url);
	const result = loadScript(JSON.parse(fetched.text), data);
	if (!result.script) throw new Error(`${link.title} could not be loaded`);
	return result.script;
}
