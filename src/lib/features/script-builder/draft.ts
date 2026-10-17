/**
 * The script being built, kept on this device so leaving the page loses nothing. Versioned,
 * because a newer build can read a draft an older one wrote (CLAUDE.md).
 */
import type { HomebrewEntries, HomebrewEntry } from '#lib/core/rules/script-builder.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { ScriptSource, VariationOf } from '#lib/features/scripts/saved-scripts.ts';

/** 2: homebrew characters and their credits; 3: the script it is a variation of (2026-10-17). */
export const DRAFT_VERSION = 3;

/** Who made a homebrew character, and its page on the site it came from. */
export interface DraftCredit {
	creator: string;
	url: string;
}

export interface ScriptDraft {
	version: typeof DRAFT_VERSION;
	name: string;
	author: string;
	/** Chosen characters, in the order they were chosen (saving sorts them). */
	ids: CharacterId[];
	/** Definitions of the chosen homebrew characters, by id, as their source wrote them. */
	homebrew: Record<CharacterId, HomebrewEntry>;
	credits: Record<CharacterId, DraftCredit>;
	/** The saved script this draft edits; saving replaces it. */
	editing?: string;
	/** The script this one was edited from; saved with it. */
	variationOf?: VariationOf;
}

export function emptyDraft(): ScriptDraft {
	return { version: DRAFT_VERSION, name: '', author: '', ids: [], homebrew: {}, credits: {} };
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

function readVariationOf(raw: unknown): VariationOf | undefined {
	if (!isObject(raw) || typeof raw.name !== 'string' || !Array.isArray(raw.json)) return undefined;
	if (!isObject(raw.source) || typeof raw.source.kind !== 'string') return undefined;
	return { name: raw.name, source: raw.source as unknown as ScriptSource, json: raw.json };
}

function readHomebrew(raw: unknown): Record<CharacterId, HomebrewEntry> {
	if (!isObject(raw)) return {};
	return Object.fromEntries(
		Object.entries(raw).flatMap(([id, entry]) => (isObject(entry) ? [[id, entry]] : []))
	);
}

function readCredits(raw: unknown): Record<CharacterId, DraftCredit> {
	if (!isObject(raw)) return {};
	return Object.fromEntries(
		Object.entries(raw).flatMap(([id, c]) =>
			isObject(c) ? [[id, { creator: text(c.creator), url: text(c.url) }]] : []
		)
	);
}

/**
 * A stored draft brought up to this version (1 had official characters only, 2 no
 * variation), or an empty
 * one when it is missing, damaged or from a newer build.
 */
export function parseDraft(raw: unknown): ScriptDraft {
	if (!isObject(raw)) return emptyDraft();
	if (raw.version !== 1 && raw.version !== 2 && raw.version !== DRAFT_VERSION) return emptyDraft();
	const variationOf = readVariationOf(raw.variationOf);
	const ids = Array.isArray(raw.ids) ? raw.ids.filter((id) => typeof id === 'string') : [];
	return {
		version: DRAFT_VERSION,
		name: text(raw.name),
		author: text(raw.author),
		ids: [...new Set(ids)],
		homebrew: readHomebrew(raw.homebrew),
		credits: readCredits(raw.credits),
		...(typeof raw.editing === 'string' ? { editing: raw.editing } : {}),
		...(variationOf ? { variationOf } : {})
	};
}

export function isEmptyDraft(draft: ScriptDraft): boolean {
	return draft.ids.length === 0 && !draft.name.trim() && !draft.author.trim();
}

/** The homebrew definitions of the chosen characters only. */
export function chosenHomebrew(draft: ScriptDraft): HomebrewEntries {
	return Object.fromEntries(
		draft.ids.flatMap((id) => (Object.hasOwn(draft.homebrew, id) ? [[id, draft.homebrew[id]]] : []))
	);
}
