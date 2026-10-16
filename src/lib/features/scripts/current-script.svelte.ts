/**
 * The current script on this device (the most recently used saved script) and the Recent
 * list. Other features read `currentScript.current`; core's `toScript` turns it into the
 * engine's `Script` for CreateGame.
 */
import {
	loadScript,
	scriptToJson,
	type GameData,
	type LoadedScript
} from '#lib/core/data/index.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { keepIconsOffline } from '#lib/features/offline/keep-offline.ts';
import { reloadSavedScript, type SavedScript, type ScriptSource } from './saved-scripts.ts';
import { IdbScriptLibrary } from './script-library.ts';
import { decodeSharedScript, sharedPayloadFromHash } from './share.ts';

let library: IdbScriptLibrary | undefined;
let current = $state.raw<{ saved: SavedScript; script: LoadedScript } | undefined>(undefined);
let recent = $state.raw<SavedScript[]>([]);
let restoring: Promise<void> | undefined;

function getLibrary(): IdbScriptLibrary | undefined {
	if (typeof indexedDB === 'undefined') return undefined;
	library ??= new IdbScriptLibrary();
	return library;
}

export const currentScript = {
	/** The script in use, or undefined before one is chosen (or while restoring). */
	get current(): LoadedScript | undefined {
		return current?.script;
	},
	/** Its saved record: where it came from, and its id in the Recent list. */
	get saved(): SavedScript | undefined {
		return current?.saved;
	}
};

export const recentScripts = {
	/** Saved scripts, most recently used first (the first is the current one). */
	get list(): SavedScript[] {
		return recent;
	}
};

async function refresh(data: GameData, lib: IdbScriptLibrary): Promise<void> {
	recent = await lib.list();
	const first = recent[0];
	const script = first && reloadSavedScript(first, data);
	current = first && script ? { saved: first, script } : undefined;
	if (script) keepIconsOffline(script.characters);
}

/** Restores the current script and Recent list from the device. Safe to call repeatedly. */
export function restoreScripts(): Promise<void> {
	restoring ??= (async () => {
		const lib = getLibrary();
		if (!lib) return;
		await refresh(await loadOfficialData(), lib);
	})().catch((e) => {
		// Storage can be unavailable (private browsing); the app still works without Recent.
		reportError(e, { area: 'scripts', notify: false });
		restoring = undefined;
	});
	return restoring;
}

type NewRecord = Pick<SavedScript, 'name' | 'edition' | 'json' | 'source'>;

/** A record that could not be saved (no storage), so the script still works this visit. */
function unsaved(record: NewRecord): SavedScript {
	const now = Date.now();
	return {
		...record,
		schemaVersion: 1,
		scriptId: 'unsaved',
		addedAt: now,
		lastUsedAt: now,
		revision: 1
	};
}

/** Makes `script` the current script and saves it to Recent. */
export async function chooseScript(chosen: LoadedScript, source: ScriptSource): Promise<void> {
	// Callers may pass reactive state; IndexedDB can only store plain objects.
	const script = $state.snapshot(chosen) as LoadedScript;
	const record: NewRecord = script.edition
		? {
				name: script.name,
				edition: script.edition,
				json: [script.edition],
				source: { kind: 'edition' }
			}
		: { name: script.name, json: scriptToJson(script), source };
	const lib = getLibrary();
	try {
		if (!lib) throw new Error('No storage');
		const saved = await lib.use(record);
		current = { saved, script };
		keepIconsOffline(script.characters);
		recent = await lib.list();
	} catch (e) {
		// Storage full, blocked or missing: still usable for this visit.
		if (lib) reportError(e, { area: 'scripts', notify: false });
		current = { saved: unsaved(record), script };
		keepIconsOffline(script.characters);
	}
}

/** Removes a script from Recent. Removing the current one makes the next one current. */
export async function forgetScript(scriptId: string): Promise<void> {
	const lib = getLibrary();
	if (!lib) return;
	await lib.delete(scriptId);
	await refresh(await loadOfficialData(), lib);
}

/**
 * For a page a share link opens (`/play#s=…`): makes the shared script the current script
 * and clears the hash. Undefined when the address has no shared script. Throws an Error
 * with a message to show when the link is damaged or has no usable characters. Unlike
 * the Storyteller's Scripts page, there is no Script check: what loads, loads.
 */
export async function openSharedScript(): Promise<LoadedScript | undefined> {
	const payload = sharedPayloadFromHash(location.hash);
	if (!payload) return undefined;
	history.replaceState(history.state, '', location.pathname + location.search);
	const [json, data] = await Promise.all([decodeSharedScript(payload), loadOfficialData()]);
	await restoreScripts();
	const { script } = loadScript(json, data);
	if (!script) throw new Error('The shared script has no characters this app knows.');
	await chooseScript(script, { kind: 'share' });
	return script;
}
