/**
 * The mode file on the Mode builder, kept on this device on every change, as the Character
 * builder keeps its character. `editing` is the id of the custom mode or rule it was opened
 * from, so Save replaces that one and Delete removes it. The key carries a version; a stored
 * draft that no longer reads starts again empty.
 */
import { emptyFile } from '#lib/core/modes/index.ts';
import { readParsed, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:mode-builder:v1';

export interface ModeDraft {
	file: Record<string, unknown>;
	editing?: string;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function parse(raw: unknown): ModeDraft {
	if (!isObject(raw) || !isObject(raw.file)) return { file: emptyFile() };
	return typeof raw.editing === 'string'
		? { file: raw.file, editing: raw.editing }
		: { file: raw.file };
}

let draft = $state.raw<ModeDraft>(readParsed(KEY, parse));

function set(next: ModeDraft) {
	draft = next;
	// Storage blocked: the draft stays for this visit only.
	writeStored(KEY, next);
}

export const modeDraft = {
	get current(): ModeDraft {
		return draft;
	},
	setFile(file: Record<string, unknown>) {
		set({ ...draft, file });
	},
	replace(next: ModeDraft) {
		set(next);
	},
	setEditing(id: string | undefined) {
		set(id ? { ...draft, editing: id } : { file: draft.file });
	},
	clear() {
		set({ file: emptyFile() });
	}
};

/** A draft with nothing typed yet: Open needn't ask before replacing it. */
export function isEmptyDraft(d: ModeDraft): boolean {
	const f = d.file;
	return (
		!d.editing &&
		!f.id &&
		!f.name &&
		(!isObject(f.parts) || Object.keys(f.parts).length === 0) &&
		(!Array.isArray(f.sources) || f.sources.length === 0)
	);
}
