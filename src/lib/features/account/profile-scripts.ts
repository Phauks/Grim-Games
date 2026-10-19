/**
 * Scripts saved to a signed-in user's profile (Trevor, 2026-10-16: "when a user adds a script,
 * it gets added to their profile"). Each is either tied to its online version or a local copy:
 *
 * - online: it came from BotC Scripts or a link, and "Check for update" fetches that source
 *   again and offers the newer version;
 * - local copy: pasted, from a file or a share link, or unlinked by the user (for example
 *   before editing it). It never changes unless the user changes it.
 *
 * Stored on the server as profile documents of kind `script` (07-accounts-and-multi-device.md
 * §2.1). Records carry `schemaVersion` because a newer build can read what an older one wrote.
 * Official editions are built into the app, so they aren't saved.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import type { SavedScript, ScriptSource } from '#lib/features/scripts/saved-scripts.ts';
import { sameScript } from '#lib/features/scripts/saved-scripts.ts';

export const PROFILE_SCRIPT_VERSION = 1;

export interface ProfileScript {
	schemaVersion: typeof PROFILE_SCRIPT_VERSION;
	name: string;
	/** The script in TPI's format (`scriptToJson`). */
	json: unknown[];
	/** Where it came from; for an online script, where updates are fetched from. */
	source: ScriptSource;
	/** Tied to the online version at `source`. Only possible when `canBeOnline(source)`. */
	online: boolean;
	addedAt: number;
}

/** One profile script with its id and the revision this device last saw. */
export interface ProfileScriptEntry {
	id: string;
	rev: number;
	updatedAt: number;
	script: ProfileScript;
}

/** Only scripts from BotC Scripts or a link have an online version to follow. */
export function canBeOnline(source: ScriptSource): boolean {
	return source.kind === 'botcscripts' || source.kind === 'link';
}

/** The profile record for a script just added on this device; undefined for an official edition. */
export function fromSavedScript(saved: SavedScript, now: number): ProfileScript | undefined {
	if (saved.edition || saved.source.kind === 'edition') return undefined;
	return {
		schemaVersion: PROFILE_SCRIPT_VERSION,
		name: saved.name,
		json: saved.json,
		source: saved.source,
		online: canBeOnline(saved.source),
		addedAt: now
	};
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads a stored record. Undefined when it can't be read or a newer build wrote it. */
export function migrateProfileScript(raw: unknown): ProfileScript | undefined {
	if (!isObject(raw) || raw.schemaVersion !== PROFILE_SCRIPT_VERSION) return undefined;
	if (typeof raw.name !== 'string' || !Array.isArray(raw.json) || !isObject(raw.source)) {
		return undefined;
	}
	if (typeof raw.source.kind !== 'string' || typeof raw.addedAt !== 'number') return undefined;
	const script = raw as unknown as ProfileScript;
	return { ...script, online: script.online === true && canBeOnline(script.source) };
}

/**
 * The profile entry `script` should update rather than be added as a new one: an online
 * script from the same BotC Scripts entry or link (it may be a newer version), or any script
 * with exactly the same characters and settings.
 */
export function findMatch(
	entries: readonly ProfileScriptEntry[],
	script: ProfileScript
): ProfileScriptEntry | undefined {
	const { source } = script;
	return (
		entries.find(({ script: other }) => {
			if (!other.online) return false;
			if (source.kind === 'botcscripts' && other.source.kind === 'botcscripts') {
				return source.scriptId === other.source.scriptId;
			}
			return (
				source.kind === 'link' && other.source.kind === 'link' && source.url === other.source.url
			);
		}) ?? entries.find(({ script: other }) => sameScript(other, script))
	);
}

/**
 * Which scripts another device took out of the profile (Library sync, 2026-10-19): `seen` is
 * each profile script's id and content key as this device last saw them, `now` the profile's
 * scripts now. Returns the content keys whose script is gone, and what to remember next.
 */
export function removedElsewhere(
	seen: Readonly<Record<string, string>>,
	now: readonly { id: string; key: string }[]
): { gone: string[]; next: Record<string, string> } {
	const next = Object.fromEntries(now.map(({ id, key }) => [id, key]));
	const kept = new Set(now.map(({ key }) => key));
	const gone = Object.entries(seen)
		.filter(([id, key]) => !(id in next) && !kept.has(key))
		.map(([, key]) => key);
	return { gone: [...new Set(gone)], next };
}

/** Whether saving `next` over `current` would change anything. */
export function differs(current: ProfileScript, next: ProfileScript): boolean {
	return (
		current.name !== next.name ||
		JSON.stringify(current.json) !== JSON.stringify(next.json) ||
		JSON.stringify(current.source) !== JSON.stringify(next.source)
	);
}

/** "BotC Scripts 1.2.0", "pastebin.com", …: where an online script is followed from. */
export function onlineSourceLabel(source: ScriptSource): string {
	if (source.kind === 'botcscripts')
		return t('account.scripts.botcScripts', { id: source.scriptId, version: source.version });
	if (source.kind === 'link') return new URL(source.url).hostname.replace(/^www\./, '');
	return t('common.none');
}
