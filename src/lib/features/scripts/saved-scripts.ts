/**
 * Scripts kept on this device: the "Recent" list, and the current script (the most
 * recently used one). Design: 08-script-loading.md §5.4.
 *
 * Records hold the TPI JSON, not the parsed script, so a newer build reparses them with
 * its own loader. They carry `schemaVersion` because a newer build can open records an
 * older build wrote (CLAUDE.md); `scriptId` and `revision` are there for 0.99 cloud sync.
 */
import {
	editionScript,
	loadScript,
	type GameData,
	type LoadedScript
} from '#lib/core/data/index.ts';

export const SAVED_SCRIPT_VERSION = 1;
/** How many scripts the Recent list keeps. */
export const MAX_SAVED_SCRIPTS = 20;

/** Where a script came from, shown in Recent and used to load it again. */
export type ScriptSource =
	| { kind: 'edition' }
	| { kind: 'paste' }
	| { kind: 'file'; fileName: string }
	| { kind: 'link'; url: string }
	| { kind: 'botcscripts'; scriptId: number; version: string }
	| { kind: 'share' };

export interface SavedScript {
	schemaVersion: typeof SAVED_SCRIPT_VERSION;
	scriptId: string;
	name: string;
	/** Set for an official edition; `json` is then unused. */
	edition?: string;
	/** The script in TPI's format (`scriptToJson`). */
	json: unknown[];
	source: ScriptSource;
	addedAt: number;
	lastUsedAt: number;
	revision: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Brings a stored record up to the current version. Undefined when it can't be read, or
 * was written by a newer build (it is then left alone, not deleted).
 */
export function migrateSavedScript(raw: unknown): SavedScript | undefined {
	if (!isObject(raw) || typeof raw.scriptId !== 'string') return undefined;
	if (raw.schemaVersion !== SAVED_SCRIPT_VERSION) return undefined;
	if (typeof raw.name !== 'string' || !Array.isArray(raw.json) || !isObject(raw.source)) {
		return undefined;
	}
	return raw as unknown as SavedScript;
}

/** Same script, whatever its source: used so loading a script again moves it to the top. */
export function sameScript(a: Pick<SavedScript, 'edition' | 'json'>, b: typeof a): boolean {
	if (a.edition || b.edition) return a.edition === b.edition;
	return JSON.stringify(a.json) === JSON.stringify(b.json);
}

/** Parses a stored record again with the current loader. */
export function reloadSavedScript(saved: SavedScript, data: GameData): LoadedScript | undefined {
	if (saved.edition) return editionScript(saved.edition, data);
	return loadScript(saved.json, data).script;
}

/** A short description of the source for the Recent list. */
export function describeSource(source: ScriptSource): string {
	switch (source.kind) {
		case 'edition':
			return 'Official';
		case 'paste':
			return 'Pasted';
		case 'file':
			return source.fileName;
		case 'link':
			return new URL(source.url).hostname.replace(/^www\./, '');
		case 'botcscripts':
			return `BotC Scripts ${source.version}`;
		case 'share':
			return 'Shared link';
	}
}
