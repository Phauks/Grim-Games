/**
 * The signed-in user's profile scripts (see `profile-scripts.ts`). The Scripts feature calls
 * `saveScriptToProfile` whenever a script is added on this device; the Account page lists,
 * checks, unlinks and removes them.
 */
import { loadScript, scriptToJson } from '#lib/core/data/index.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { fetchLinkTarget, type FetchedScript } from '#lib/features/scripts/fetch-script.ts';
import type { SavedScript, ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
import { resolveLink } from '#lib/features/scripts/script-links.ts';
import { AccountApiError, accountApi } from './account-api.ts';
import { account } from './account.svelte.ts';
import type { ProfileDoc } from './account-protocol.ts';
import {
	differs,
	findMatch,
	fromSavedScript,
	migrateProfileScript,
	type ProfileScript,
	type ProfileScriptEntry
} from './profile-scripts.ts';

export type ProfileScriptsStatus = 'idle' | 'loading' | 'ready' | 'error';

let entries = $state.raw<ProfileScriptEntry[]>([]);
let status = $state<ProfileScriptsStatus>('idle');
let error = $state<string | undefined>(undefined);
let loading: Promise<void> | undefined;
let loadedFor: string | undefined;

function toEntries(docs: ProfileDoc[]): ProfileScriptEntry[] {
	return docs.flatMap((doc) => {
		if (doc.deleted) return [];
		const script = migrateProfileScript(doc.body);
		return script ? [{ id: doc.id, rev: doc.rev, updatedAt: doc.updatedAt, script }] : [];
	});
}

function replace(doc: ProfileDoc): void {
	const rest = entries.filter((entry) => entry.id !== doc.id);
	entries = [...toEntries([doc]), ...rest].sort((a, b) => b.updatedAt - a.updatedAt);
}

const IMPORTED_KEY = 'grim-games:profile-scripts-imported';

/** Whether this device's Recent scripts were already added to `userId`'s profile. */
function importedFor(userId: string): boolean {
	try {
		return (localStorage.getItem(IMPORTED_KEY) ?? '').split(',').includes(userId);
	} catch {
		return true;
	}
}

function markImported(userId: string): void {
	try {
		const ids = (localStorage.getItem(IMPORTED_KEY) ?? '').split(',').filter(Boolean);
		localStorage.setItem(IMPORTED_KEY, [...ids, userId].slice(-5).join(','));
	} catch {
		// No storage: the Recent list is offered again next time, which is harmless.
	}
}

/**
 * The first time a user signs in on this device, the scripts already in its Recent list are
 * added to their profile too, so "added scripts are in the profile" holds for scripts added
 * before signing in. Imported lazily: the Scripts feature imports this module.
 */
async function importDeviceScripts(userId: string): Promise<void> {
	if (importedFor(userId)) return;
	const { recentScripts, restoreScripts } =
		await import('#lib/features/scripts/current-script.svelte.ts');
	await restoreScripts();
	// Oldest first, so the profile's order matches the device's.
	for (const saved of [...recentScripts.list].reverse()) {
		if (account.user?.id !== userId) return;
		await saveScriptToProfile(saved);
	}
	if (profileScripts.status === 'ready') markImported(userId);
}

account.onChange((user) => {
	entries = [];
	loadedFor = undefined;
	status = 'idle';
	if (user) {
		void profileScripts
			.refresh()
			.then(() => importDeviceScripts(user.id))
			.catch((e) => reportError(e, { area: 'account', notify: false }));
	}
});

/** Saves a document; on a conflict, takes the server's copy and tries once more. */
async function put(
	id: string,
	baseRev: number,
	script: ProfileScript | undefined,
	retry = true
): Promise<void> {
	try {
		const doc = await accountApi.putDoc<ProfileScript>(
			'script',
			id,
			script ? { baseRev, body: script } : { baseRev, deleted: true }
		);
		replace(doc);
	} catch (e) {
		if (retry && e instanceof AccountApiError && e.status === 409) {
			const server = e.body as ProfileDoc;
			replace(server);
			return put(id, server.rev, script, false);
		}
		throw e;
	}
}

export const profileScripts = {
	get list(): ProfileScriptEntry[] {
		return entries;
	},
	get status(): ProfileScriptsStatus {
		return status;
	},
	get error(): string | undefined {
		return error;
	},

	/** Loads the profile's scripts from the server. */
	refresh(): Promise<void> {
		const user = account.user;
		if (!user) return Promise.resolve();
		loading ??= (async () => {
			status = 'loading';
			try {
				entries = toEntries(await accountApi.listDocs('script'));
				loadedFor = user.id;
				status = 'ready';
				error = undefined;
			} catch (e) {
				status = 'error';
				error = e instanceof Error ? e.message : String(e);
				if (!(e instanceof AccountApiError)) reportError(e, { area: 'account', notify: false });
			}
		})().finally(() => (loading = undefined));
		return loading;
	},

	/** Stops following the online version: the script becomes a local copy. */
	async unlink(entry: ProfileScriptEntry): Promise<void> {
		await put(entry.id, entry.rev, { ...entry.script, online: false });
	},

	async remove(entry: ProfileScriptEntry): Promise<void> {
		await put(entry.id, entry.rev, undefined);
		entries = entries.filter((other) => other.id !== entry.id);
	},

	/**
	 * Fetches an online script's source again. Returns the newer version to offer, or
	 * undefined when the profile already has it. Throws with a message to show.
	 */
	async checkForUpdate(entry: ProfileScriptEntry): Promise<ProfileScript | undefined> {
		const { source } = entry.script;
		let fetched: FetchedScript;
		if (source.kind === 'botcscripts') {
			fetched = await fetchLinkTarget(
				{ kind: 'botcscripts', ref: { kind: 'script', scriptId: source.scriptId } },
				''
			);
		} else if (source.kind === 'link') {
			fetched = await fetchLinkTarget(resolveLink(source.url), source.url);
		} else {
			return undefined;
		}
		let raw: unknown;
		try {
			raw = JSON.parse(fetched.text);
		} catch {
			throw new Error('The online version is not a script any more.');
		}
		const { script } = loadScript(raw, await loadOfficialData());
		if (!script) throw new Error('The online version has no characters this app knows.');
		const next: ProfileScript = {
			...entry.script,
			name: script.name || entry.script.name,
			json: scriptToJson(script),
			source: fetched.source as ScriptSource
		};
		return differs(entry.script, next) ? next : undefined;
	},

	/** Saves the newer version found by `checkForUpdate`. */
	async applyUpdate(entry: ProfileScriptEntry, next: ProfileScript): Promise<void> {
		await put(entry.id, entry.rev, next);
	}
};

/**
 * Adds a script just added on this device to the signed-in user's profile, or updates the
 * matching one (a newer version of the same online script, or the same script again).
 * Does nothing when signed out or for official editions. Never throws: the script is
 * already saved on the device, so a failure here is only logged.
 */
export async function saveScriptToProfile(saved: SavedScript): Promise<void> {
	try {
		const user = account.user;
		if (!user || saved.scriptId === 'unsaved') return;
		const script = fromSavedScript($state.snapshot(saved) as SavedScript, Date.now());
		if (!script) return;
		if (loadedFor !== user.id) await profileScripts.refresh();
		if (loadedFor !== user.id) return;
		const match = findMatch(entries, script);
		if (!match) return await put(crypto.randomUUID(), 0, script);
		if (!differs(match.script, script)) return;
		// Keep the user's online/local choice and when it was first added.
		await put(match.id, match.rev, {
			...script,
			online: match.script.online,
			addedAt: match.script.addedAt
		});
	} catch (e) {
		reportError(e, { area: 'account', notify: false });
	}
}
