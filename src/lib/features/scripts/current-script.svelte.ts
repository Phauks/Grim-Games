/**
 * The current script on this device (the most recently used saved script) and the Recent
 * list. Other features read `currentScript.current`; core's `toScript` turns it into the
 * engine's `Script` for CreateGame.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import {
	loadScriptText,
	scriptToJson,
	type GameData,
	type LoadedScript
} from '#lib/core/data/index.ts';
import { timestampName } from '#lib/core/timestamp-name.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { saveScriptToProfile } from '#lib/features/account/profile-scripts.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { keepIconsOffline } from '#lib/features/offline/keep-offline.ts';
import {
	migrateSavedScript,
	reloadSavedScript,
	type SavedScript,
	type ScriptSource
} from './saved-scripts.ts';
import { IdbScriptLibrary } from './script-library.ts';
import { fetchSharedRef } from './share-codes.ts';
import { sharedRefFromHash } from './share.ts';

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

/**
 * Stores the script's icons for offline use, with its edition's Travellers: the player
 * sheet and the Traveller picker show those even though they are not on the script.
 */
function keepScriptOffline(script: LoadedScript, data: GameData): void {
	const travellers = script.edition
		? data.characters.filter((c) => c.edition === script.edition && c.type === 'traveller')
		: [];
	keepIconsOffline([...script.characters, ...travellers]);
}

async function refresh(data: GameData, lib: IdbScriptLibrary): Promise<void> {
	recent = await lib.list();
	const first = recent[0];
	const script = first && reloadSavedScript(first, data);
	current = first && script ? { saved: first, script } : undefined;
	if (script) keepScriptOffline(script, data);
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

function recordFor(script: LoadedScript, source: ScriptSource): NewRecord {
	return script.edition
		? {
				name: script.name,
				edition: script.edition,
				json: [script.edition],
				source: { kind: 'edition' }
			}
		: { name: script.name, json: scriptToJson(script), source };
}

/** Makes `script` the current script and saves it to Recent. */
export async function chooseScript(chosen: LoadedScript, source: ScriptSource): Promise<void> {
	// Callers may pass reactive state; IndexedDB can only store plain objects.
	const snapshot = $state.snapshot(chosen) as LoadedScript;
	// Nothing is saved without a name (Trevor, 2026-10-18): a nameless one gets a timestamp.
	const named = snapshot.name.trim() || timestampName();
	const script: LoadedScript =
		named === snapshot.name
			? snapshot
			: { ...snapshot, name: named, meta: { ...snapshot.meta, name: named } };
	const record = recordFor(script, source);
	const lib = getLibrary();
	try {
		if (!lib) throw new Error('No storage');
		const saved = await lib.use(record);
		// Signed in: also keep it in the account's scripts (no-op otherwise; never throws).
		void saveScriptToProfile(saved);
		current = { saved, script };
		recent = await lib.list();
	} catch (e) {
		// Storage full, blocked or missing: still usable for this visit.
		if (lib) reportError(e, { area: 'scripts', notify: false });
		current = { saved: unsaved(record), script };
	}
	void loadOfficialData()
		.then((data) => keepScriptOffline(script, data))
		.catch(() => {});
}

/**
 * A script played straight from the Scripts page without saving it (Trevor, 2026-10-17:
 * the Library stays the scripts the user knows). One at a time, kept on this device apart
 * from the saved scripts so the Library never lists it; New game offers it until another
 * script is played this way. The game itself keeps its own copy of the script.
 */
const QUICK_PLAY_KEY = 'grim-games:scripts:quick-play';
export const QUICK_PLAY_ID = 'quick-play';

/** Read once when this module loads in the browser (never inside a derived value). */
function storedQuick(): SavedScript | undefined {
	try {
		return migrateSavedScript(
			JSON.parse(globalThis.localStorage?.getItem(QUICK_PLAY_KEY) ?? 'null')
		);
	} catch {
		// No storage, or an unreadable copy: nothing to offer.
		return undefined;
	}
}

let quick = $state.raw<SavedScript | undefined>(storedQuick());
/** Set by Play until New game opens with it chosen. */
let quickRequested = false;

export const quickPlayScript = {
	get saved(): SavedScript | undefined {
		return quick;
	},
	/** True once after Play: New game then opens with this script chosen. */
	takeRequest(): boolean {
		const asked = quickRequested;
		quickRequested = false;
		return asked && quick !== undefined;
	}
};

/** Keeps `script` as the one to play next, without saving it to the Library. */
export function playScript(chosen: LoadedScript, source: ScriptSource): void {
	const script = $state.snapshot(chosen) as LoadedScript;
	quick = { ...unsaved(recordFor(script, source)), scriptId: QUICK_PLAY_ID };
	quickRequested = true;
	try {
		localStorage.setItem(QUICK_PLAY_KEY, JSON.stringify(quick));
	} catch {
		// No storage: still offered for this visit.
	}
	void loadOfficialData()
		.then((data) => keepScriptOffline(script, data))
		.catch(() => {});
}

/** Removes a script from Recent. Removing the current one makes the next one current. */
export async function forgetScript(scriptId: string): Promise<void> {
	const lib = getLibrary();
	if (!lib) return;
	await lib.delete(scriptId);
	await refresh(await loadOfficialData(), lib);
}

/**
 * For a page a share link opens (`/play#c=…`, `#e=`, `#bs=` or `#s=`): makes the shared
 * script the current script and clears the hash. Undefined when the address has no shared
 * script. Throws an Error with a message to show when the link is damaged, the code has
 * expired, or the script has no usable characters. Unlike the Storyteller's Scripts page,
 * there is no Script check: what loads, loads.
 */
export async function openSharedScript(): Promise<LoadedScript | undefined> {
	const ref = sharedRefFromHash(location.hash);
	if (!ref) return undefined;
	history.replaceState(history.state, '', location.pathname + location.search);
	return openScriptCode(fetchSharedRef(ref));
}

/**
 * Loads a script fetched for a share link or a typed code (`fetchSharedCode`) and makes
 * it the current script. Throws an Error with a message to show.
 */
export async function openScriptCode(
	fetching: Promise<{ text: string; source: ScriptSource }>
): Promise<LoadedScript> {
	const [fetched, data] = await Promise.all([fetching, loadOfficialData()]);
	await restoreScripts();
	const { script } = loadScriptText(fetched.text, data);
	if (!script) throw new Error(t('scripts.error.noKnownCharacters'));
	await chooseScript(script, fetched.source);
	return script;
}
