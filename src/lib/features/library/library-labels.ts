/**
 * The user's own folders and tags for their scripts (Trevor, 2026-10-16: "allow putting scripts
 * into folders, or tagging them as (favorite) or (wanna try) or (stupid fun)"). A script sits in
 * at most one folder and can carry any number of tags.
 *
 * Labels are kept apart from the scripts themselves and keyed by what the script is
 * (`libraryKey`), so the same script keeps its labels whether it is listed from this device or
 * from the account, and saved records never change shape. Versioned, because a newer build can
 * open what an older one stored (CLAUDE.md).
 */

export const LIBRARY_LABELS_VERSION = 1;
/** Longest folder or tag name. */
export const MAX_LABEL_NAME = 40;

export type LabelKind = 'tags' | 'folders';

export interface Label {
	id: string;
	name: string;
}

export interface ScriptLabels {
	tags: string[];
	folder?: string;
}

export interface LibraryLabels {
	version: typeof LIBRARY_LABELS_VERSION;
	tags: Label[];
	folders: Label[];
	/** By `libraryKey`. Scripts with no folder and no tags have no entry. */
	scripts: Record<string, ScriptLabels>;
}

export function emptyLabels(): LibraryLabels {
	return { version: LIBRARY_LABELS_VERSION, tags: [], folders: [], scripts: {} };
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readLabels(raw: unknown): Label[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((l) =>
		isObject(l) && typeof l.id === 'string' && typeof l.name === 'string'
			? [{ id: l.id, name: l.name }]
			: []
	);
}

/**
 * Reads what was stored. Unreadable or missing data starts empty; data from a newer build is
 * undefined, so the caller leaves it alone rather than overwriting it.
 */
export function parseLabels(raw: unknown): LibraryLabels | undefined {
	if (!isObject(raw)) return emptyLabels();
	if (typeof raw.version === 'number' && raw.version > LIBRARY_LABELS_VERSION) return undefined;
	if (raw.version !== LIBRARY_LABELS_VERSION) return emptyLabels();
	const tags = readLabels(raw.tags);
	const folders = readLabels(raw.folders);
	const tagIds = new Set(tags.map((t) => t.id));
	const folderIds = new Set(folders.map((f) => f.id));
	const scripts: Record<string, ScriptLabels> = {};
	if (isObject(raw.scripts)) {
		for (const [key, value] of Object.entries(raw.scripts)) {
			if (!isObject(value)) continue;
			const entry = tidy({
				tags: Array.isArray(value.tags)
					? value.tags.filter((t): t is string => typeof t === 'string' && tagIds.has(t))
					: [],
				folder:
					typeof value.folder === 'string' && folderIds.has(value.folder) ? value.folder : undefined
			});
			if (entry) scripts[key] = entry;
		}
	}
	return { version: LIBRARY_LABELS_VERSION, tags, folders, scripts };
}

/** Undefined when the script has nothing left, so its entry is dropped. */
function tidy(entry: ScriptLabels): ScriptLabels | undefined {
	const tags = [...new Set(entry.tags)];
	if (!tags.length && !entry.folder) return undefined;
	return entry.folder ? { tags, folder: entry.folder } : { tags };
}

function withScript(state: LibraryLabels, key: string, entry: ScriptLabels): LibraryLabels {
	const scripts = { ...state.scripts };
	const clean = tidy(entry);
	if (clean) scripts[key] = clean;
	else delete scripts[key];
	return { ...state, scripts };
}

/**
 * A key for a script from what it is: an official edition by its id, any other script by its
 * JSON. Matches `sameScript` (saved-scripts.ts): the same JSON gives the same key.
 */
export function libraryKey(identity: { edition?: string; json: readonly unknown[] }): string {
	if (identity.edition) return `edition:${identity.edition}`;
	// FNV-1a over the JSON, two 32-bit halves with different seeds: short, stable, no crypto.
	const text = JSON.stringify(identity.json);
	let a = 0x811c9dc5;
	let b = 0x01000193 ^ text.length;
	for (let i = 0; i < text.length; i++) {
		const c = text.charCodeAt(i);
		a = Math.imul(a ^ c, 0x01000193);
		b = Math.imul(b ^ c, 0x5bd1e995);
	}
	return `json:${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

export function cleanName(name: string): string {
	return name.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL_NAME);
}

/** Whether `name` is free to use (names are compared ignoring case); `except` is a renamed label. */
export function nameFree(labels: readonly Label[], name: string, except?: string): boolean {
	const wanted = cleanName(name).toLocaleLowerCase();
	return (
		wanted !== '' && !labels.some((l) => l.id !== except && l.name.toLocaleLowerCase() === wanted)
	);
}

/** Adds a folder or tag. Blank or taken names change nothing. */
export function addLabel(
	state: LibraryLabels,
	kind: LabelKind,
	name: string,
	id: string
): LibraryLabels {
	if (!nameFree(state[kind], name)) return state;
	return { ...state, [kind]: [...state[kind], { id, name: cleanName(name) }] };
}

export function renameLabel(
	state: LibraryLabels,
	kind: LabelKind,
	id: string,
	name: string
): LibraryLabels {
	if (!nameFree(state[kind], name, id)) return state;
	return {
		...state,
		[kind]: state[kind].map((l) => (l.id === id ? { ...l, name: cleanName(name) } : l))
	};
}

/** Deletes a folder or tag; its scripts stay, without it. */
export function deleteLabel(state: LibraryLabels, kind: LabelKind, id: string): LibraryLabels {
	let next: LibraryLabels = { ...state, [kind]: state[kind].filter((l) => l.id !== id) };
	for (const [key, entry] of Object.entries(state.scripts)) {
		if (kind === 'tags' && entry.tags.includes(id)) {
			next = withScript(next, key, { ...entry, tags: entry.tags.filter((t) => t !== id) });
		}
		if (kind === 'folders' && entry.folder === id) {
			next = withScript(next, key, { tags: entry.tags });
		}
	}
	return next;
}

/** How many scripts use a folder or tag. */
export function labelUses(state: LibraryLabels, kind: LabelKind, id: string): number {
	return Object.values(state.scripts).filter((entry) =>
		kind === 'tags' ? entry.tags.includes(id) : entry.folder === id
	).length;
}

export function labelsFor(state: LibraryLabels, key: string): ScriptLabels {
	return state.scripts[key] ?? { tags: [] };
}

/** Puts a script in a folder, or in none. */
export function setFolder(
	state: LibraryLabels,
	key: string,
	folder: string | undefined
): LibraryLabels {
	if (folder !== undefined && !state.folders.some((f) => f.id === folder)) return state;
	const entry = labelsFor(state, key);
	return withScript(state, key, { tags: entry.tags, folder });
}

/** Adds the tag to the script, or takes it off. */
export function toggleTag(state: LibraryLabels, key: string, tag: string): LibraryLabels {
	if (!state.tags.some((t) => t.id === tag)) return state;
	const entry = labelsFor(state, key);
	const tags = entry.tags.includes(tag)
		? entry.tags.filter((t) => t !== tag)
		: [...entry.tags, tag];
	return withScript(state, key, { ...entry, tags });
}

/** Folder filter: every script, scripts in no folder, or one folder's. */
export type FolderFilter = { kind: 'all' } | { kind: 'none' } | { kind: 'folder'; id: string };

export interface LibraryFilter {
	term: string;
	folder: FolderFilter;
	/** Scripts carrying every one of these tags. */
	tags: readonly string[];
}

/** Rows matching the search, folder and tags. `haystack` is lower-cased searchable text. */
export function filterLibrary<T extends { key: string; haystack: string }>(
	rows: readonly T[],
	state: LibraryLabels,
	filter: LibraryFilter
): T[] {
	const term = filter.term.trim().toLocaleLowerCase();
	return rows.filter((row) => {
		if (term && !row.haystack.includes(term)) return false;
		const entry = labelsFor(state, row.key);
		if (filter.folder.kind === 'none' && entry.folder) return false;
		if (filter.folder.kind === 'folder' && entry.folder !== filter.folder.id) return false;
		return filter.tags.every((tag) => entry.tags.includes(tag));
	});
}

/** Labels sorted by name, the way lists of them are shown. */
export function byName(labels: readonly Label[]): Label[] {
	return [...labels].sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
	);
}
