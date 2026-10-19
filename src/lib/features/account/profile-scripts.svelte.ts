/**
 * The signed-in user's profile scripts (see `profile-scripts.ts`). The Scripts feature calls
 * `saveScriptToProfile` whenever a script is added on this device; the Account page lists,
 * checks, unlinks and removes them.
 */
import { loadScript, scriptToJson } from '#lib/core/data/index.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { fetchLinkTarget, type FetchedScript } from '#lib/features/scripts/fetch-script.ts';
import type { SavedScript, ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
import { resolveLink } from '#lib/features/scripts/script-links.ts';
import { account } from './account.svelte.ts';
import type { ProfileDoc } from './account-protocol.ts';
import { firstSignIn } from './first-sign-in.svelte.ts';
import { accountSync } from './sync/sync.svelte.ts';
import {
	differs,
	findMatch,
	fromSavedScript,
	migrateProfileScript,
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

/** This device's Recent scripts, oldest first, so the profile's order matches the device's. */
async function deviceScripts(): Promise<SavedScript[]> {
	// Imported lazily: the Scripts feature imports this module.
	const { recentScripts, restoreScripts } =
		await import('#lib/features/scripts/current-script.svelte.ts');
	await restoreScripts();
	return [...recentScripts.list].reverse();
}

// The first sign-in sheet offers the scripts this device had before signing in.
firstSignIn.register('script', {
	async count() {
		const now = Date.now();
		return (await deviceScripts()).filter((saved) => {
			const script = fromSavedScript($state.snapshot(saved) as SavedScript, now);
			return script && !findMatch(entries, script);
		}).length;
	},
	async upload() {
		for (const saved of await deviceScripts()) await saveScriptToProfile(saved);
	}
});

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
