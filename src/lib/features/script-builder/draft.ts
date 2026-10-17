/**
 * The script being built, kept on this device so leaving the page loses nothing. Versioned,
 * because a newer build can read a draft an older one wrote (CLAUDE.md).
 */
import type { CharacterId } from '#lib/core/data/types.ts';

export const DRAFT_VERSION = 1;

export interface ScriptDraft {
	version: typeof DRAFT_VERSION;
	name: string;
	author: string;
	/** Chosen official characters, in the order they were chosen (saving sorts them). */
	ids: CharacterId[];
	/** The saved script this draft edits; saving replaces it. */
	editing?: string;
}

export function emptyDraft(): ScriptDraft {
	return { version: DRAFT_VERSION, name: '', author: '', ids: [] };
}

/** A stored draft, or an empty one when it is missing, damaged or from a newer build. */
export function parseDraft(raw: unknown): ScriptDraft {
	if (typeof raw !== 'object' || raw === null) return emptyDraft();
	const r = raw as Record<string, unknown>;
	if (r.version !== DRAFT_VERSION) return emptyDraft();
	const text = (value: unknown) => (typeof value === 'string' ? value : '');
	const ids = Array.isArray(r.ids) ? r.ids.filter((id) => typeof id === 'string') : [];
	return {
		version: DRAFT_VERSION,
		name: text(r.name),
		author: text(r.author),
		ids: [...new Set(ids)],
		...(typeof r.editing === 'string' ? { editing: r.editing } : {})
	};
}

export function isEmptyDraft(draft: ScriptDraft): boolean {
	return draft.ids.length === 0 && !draft.name.trim() && !draft.author.trim();
}
