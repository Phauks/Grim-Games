/**
 * The signed-in user's profile scripts (see `profile-scripts.ts`). The Scripts feature calls
 * `saveScriptToProfile` whenever a script is added on this device; the Account page lists,
 * checks, unlinks and removes them.
 */
import { untrack } from 'svelte';
import { loadScript, scriptToJson } from '#lib/core/data/index.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { fetchLinkTarget, type FetchedScript } from '#lib/features/scripts/fetch-script.ts';
import type { SavedScript, ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
import { resolveLink } from '#lib/features/scripts/script-links.ts';
import { account } from './account.svelte.ts';
import type { ProfileDoc } from './account-protocol.ts';
import { accountSync } from './sync/sync.svelte.ts';
import { libraryKey } from '#lib/features/library/library-labels.ts';
import { readStored, readStoredText, writeStored, writeStoredText } from '#lib/ui/stored.ts';
import {
	differs,
	findMatch,
	fromSavedScript,
	migrateProfileScript,
	removedElsewhere,
	type ProfileScript,
	type ProfileScriptEntry
} from './profile-scripts.ts';

export type ProfileScriptsStatus = 'idle' | 'loading' | 'ready' | 'error';

// When both devices changed a script, this device's version is kept beside it, renamed.
accountSync.register('script', {
	copy: (body) => {
		const script = migrateProfileScript(body);
		return script
			? { ...script, name: t('account.sync.otherDevice', { name: script.name }) }
			: body;
	}
});

function toEntries(docs: ProfileDoc[]): ProfileScriptEntry[] {
	return docs.flatMap((doc) => {
		const script = migrateProfileScript(doc.body);
		return script ? [{ id: doc.id, rev: doc.rev, updatedAt: doc.updatedAt, script }] : [];
	});
}

const entries = $derived(toEntries(accountSync.docs('script')));

const IMPORTED_KEY = 'grim-games:profile-scripts-imported';

/** Whether this device's Recent scripts were already added to `userId`'s profile. */
function importedFor(userId: string): boolean {
	const ids = readStoredText(IMPORTED_KEY);
	return ids === undefined ? false : ids.split(',').includes(userId);
}

function markImported(userId: string): void {
	const ids = (readStoredText(IMPORTED_KEY) ?? '').split(',').filter(Boolean);
	// No storage: the Recent list is offered again next time, which is harmless.
	writeStoredText(IMPORTED_KEY, [...ids, userId].slice(-5).join(','));
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
	// The account's scripts first, so ones already there are matched instead of added again.
	await accountSync.syncNow();
	if (account.user?.id !== userId || !accountSync.pulled) return;
	// Oldest first, so the profile's order matches the device's.
	for (const saved of [...recentScripts.list].reverse()) {
		if (account.user?.id !== userId) return;
		await saveScriptToProfile(saved);
	}
	markImported(userId);
}

account.onChange((user) => {
	if (user) {
		void importDeviceScripts(user.id).catch((e) =>
			reportError(e, { area: 'account', notify: false })
		);
	}
});

const SEEN_KEY = 'grim-games:profile-scripts-seen';

interface Seen {
	userId: string;
	/** Each profile script's id and content key (`libraryKey`) when last seen here. */
	scripts: Record<string, string>;
}

/**
 * Library and profile scripts are one list (sync plan, Trevor 2026-10-18): a script removed
 * on another device also leaves this device's Recent list, so the Library doesn't keep it.
 */
async function followRemovals(userId: string, now: { id: string; key: string }[]): Promise<void> {
	const stored = readStored<Seen>(SEEN_KEY);
	const seen = stored?.userId === userId && stored.scripts ? stored.scripts : {};
	const { gone, next } = removedElsewhere(seen, now);
	// No storage: nothing is remembered, so nothing is ever taken off this device.
	writeStored(SEEN_KEY, { userId, scripts: next } satisfies Seen);
	// Until this device's Recent scripts have joined the profile, a missing one proves nothing.
	if (gone.length === 0 || !importedFor(userId)) return;
	const { recentScripts, restoreScripts, forgetScript } =
		await import('#lib/features/scripts/current-script.svelte.ts');
	await restoreScripts();
	for (const saved of recentScripts.list) {
		if (account.user?.id !== userId) return;
		if (!saved.edition && gone.includes(libraryKey(saved))) await forgetScript(saved.scriptId);
	}
}

if (typeof window !== 'undefined') {
	$effect.root(() => {
		$effect(() => {
			const user = account.user;
			if (!user || !accountSync.ready || !accountSync.pulled) return;
			if (!accountSync.enabled('script')) return;
			const now = entries.map((e) => ({ id: e.id, key: libraryKey({ json: e.script.json }) }));
			untrack(() => {
				void followRemovals(user.id, now).catch((e) =>
					reportError(e, { area: 'account', notify: false })
				);
			});
		});
	});
}

/** Saves a script (undefined removes it); the change reaches the account in the background. */
function put(id: string, script: ProfileScript | undefined): Promise<void> {
	return script ? accountSync.save('script', id, script) : accountSync.remove('script', id);
}

export const profileScripts = {
	get list(): ProfileScriptEntry[] {
		return entries;
	},
	/**
	 * What the list can show: loading until this device has the account's scripts, an error
	 * only when it has none to show yet (offline or failing, the saved copy is still shown).
	 */
	get status(): ProfileScriptsStatus {
		if (!account.user) return 'idle';
		if (accountSync.pulled) return 'ready';
		return accountSync.status === 'error' || accountSync.status === 'offline' ? 'error' : 'loading';
	},
	get error(): string | undefined {
		return (
			accountSync.error ?? (accountSync.status === 'offline' ? t('account.offline') : undefined)
		);
	},

	/** Sends this device's changes and fetches the account's scripts now. */
	refresh(): Promise<void> {
		return accountSync.syncNow();
	},

	/** Stops following the online version: the script becomes a local copy. */
	async unlink(entry: ProfileScriptEntry): Promise<void> {
		await put(entry.id, { ...entry.script, online: false });
	},

	async remove(entry: ProfileScriptEntry): Promise<void> {
		await put(entry.id, undefined);
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
			throw new Error(t('account.scripts.notAScript'));
		}
		const { script } = loadScript(raw, await loadOfficialData());
		if (!script) throw new Error(t('account.scripts.onlineUnknownCharacters'));
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
		await put(entry.id, next);
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
		if (saved.scriptId === 'unsaved') return;
		// The session may not have been checked yet on this page load.
		if (account.status === 'checking') await account.refresh();
		const user = account.user;
		if (!user) return;
		const script = fromSavedScript($state.snapshot(saved) as SavedScript, Date.now());
		if (!script) return;
		await accountSync.whenReady();
		if (account.user?.id !== user.id) return;
		const match = findMatch(entries, script);
		if (!match) return await put(crypto.randomUUID(), script);
		if (!differs(match.script, script)) return;
		// Keep the user's online/local choice and when it was first added.
		await put(match.id, {
			...script,
			online: match.script.online,
			addedAt: match.script.addedAt
		});
	} catch (e) {
		reportError(e, { area: 'account', notify: false });
	}
}
