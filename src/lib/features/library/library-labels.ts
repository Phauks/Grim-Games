/**
 * The user's own folders and tags for their scripts (Trevor, 2026-10-16: "allow putting scripts
 * into folders, or tagging them as (favorite) or (wanna try) or (stupid fun)"). A script sits in
 * at most one folder and can carry any number of tags. Folders nest like a file manager's
 * (Trevor, 2026-10-17: "hold scripts like files in a file manager").
 *
 * Labels are kept apart from the scripts themselves and keyed by what the script is
 * (`libraryKey`), so the same script keeps its labels whether it is listed from this device or
 * from the account, and saved records never change shape. Versioned, because a newer build can
 * open what an older one stored (CLAUDE.md).
 */

/** 2: folders can sit inside other folders (`parent`). Version 1 data reads as top-level folders. */
export const LIBRARY_LABELS_VERSION = 2;
/** Longest folder or tag name. */
export const MAX_LABEL_NAME = 40;
/** A renamed item's name: as long as a script's own name may reasonably be. */
export const MAX_ITEM_NAME = 80;

export type LabelKind = 'tags' | 'folders';

export interface Label {
	id: string;
	name: string;
	/** Folders only: the folder this one sits in; none for the top level. */
	parent?: string;
}

export interface ScriptLabels {
	tags: string[];
	folder?: string;
	/**
	 * The item's name in the Library, when renamed here (Trevor, 2026-10-18). The script itself
	 * and where it came from are unchanged, so Search still finds it as saved.
	 */
	name?: string;
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
			? [
					typeof l.parent === 'string'
						? { id: l.id, name: l.name, parent: l.parent }
						: { id: l.id, name: l.name }
				]
			: []
	);
}

/** Drops parents that are missing or would make a loop, so every folder reaches the top level. */
function rootedFolders(folders: Label[]): Label[] {
	const ids = new Set(folders.map((f) => f.id));
	const parentOf = new Map(folders.map((f) => [f.id, f.parent]));
	return folders.map((f) => {
		if (f.parent === undefined) return f;
		const seen = new Set([f.id]);
		let at: string | undefined = f.parent;
		while (at !== undefined) {
			if (!ids.has(at) || seen.has(at)) return { id: f.id, name: f.name };
			seen.add(at);
			at = parentOf.get(at);
		}
		return f;
	});
}

/**
 * Reads what was stored. Unreadable or missing data starts empty; data from a newer build is
 * undefined, so the caller leaves it alone rather than overwriting it.
 */
export function parseLabels(raw: unknown): LibraryLabels | undefined {
	if (!isObject(raw)) return emptyLabels();
	if (typeof raw.version === 'number' && raw.version > LIBRARY_LABELS_VERSION) return undefined;
	if (raw.version !== 1 && raw.version !== LIBRARY_LABELS_VERSION) return emptyLabels();
	const tags = readLabels(raw.tags).map(({ id, name }) => ({ id, name }));
	const folders = rootedFolders(readLabels(raw.folders));
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
					typeof value.folder === 'string' && folderIds.has(value.folder)
						? value.folder
						: undefined,
				name: typeof value.name === 'string' ? value.name : undefined
			});
			if (entry) scripts[key] = entry;
		}
	}
	return { version: LIBRARY_LABELS_VERSION, tags, folders, scripts };
}

/** Undefined when the script has nothing left, so its entry is dropped. */
function tidy(entry: ScriptLabels): ScriptLabels | undefined {
	const tags = [...new Set(entry.tags)];
	const name = entry.name?.trim().replace(/\s+/g, ' ').slice(0, MAX_ITEM_NAME) ?? '';
	if (!tags.length && !entry.folder && !name) return undefined;
	return {
		tags,
		...(entry.folder ? { folder: entry.folder } : {}),
		...(name ? { name } : {})
	};
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

/** The labels a new name must differ from: every tag, or a folder's siblings. */
export function siblings(
	state: LibraryLabels,
	kind: LabelKind,
	parent: string | undefined
): Label[] {
	return kind === 'tags' ? state.tags : state.folders.filter((f) => f.parent === parent);
}

/** Adds a tag, or a folder inside `parent` (top level when none). Blank or taken names change nothing. */
export function addLabel(
	state: LibraryLabels,
	kind: LabelKind,
	name: string,
	id: string,
	parent?: string
): LibraryLabels {
	const inside =
		kind === 'folders' && state.folders.some((f) => f.id === parent) ? parent : undefined;
	if (!nameFree(siblings(state, kind, inside), name)) return state;
	const label: Label = inside
		? { id, name: cleanName(name), parent: inside }
		: { id, name: cleanName(name) };
	return { ...state, [kind]: [...state[kind], label] };
}

export function renameLabel(
	state: LibraryLabels,
	kind: LabelKind,
	id: string,
	name: string
): LibraryLabels {
	const parent = state[kind].find((l) => l.id === id)?.parent;
	if (!nameFree(siblings(state, kind, parent), name, id)) return state;
	return {
		...state,
		[kind]: state[kind].map((l) => (l.id === id ? { ...l, name: cleanName(name) } : l))
	};
}

/**
 * Deletes a tag, taking it off its scripts; or a folder, moving what it held (scripts and
 * folders) up into its own parent, so nothing is lost. A moved folder whose name is taken there
 * keeps its name; names are only checked when the user types one.
 */
export function deleteLabel(state: LibraryLabels, kind: LabelKind, id: string): LibraryLabels {
	const up = kind === 'folders' ? state.folders.find((f) => f.id === id)?.parent : undefined;
	let next: LibraryLabels = {
		...state,
		[kind]: state[kind]
			.filter((l) => l.id !== id)
			.map((l) =>
				kind === 'folders' && l.parent === id
					? up
						? { ...l, parent: up }
						: { id: l.id, name: l.name }
					: l
			)
	};
	for (const [key, entry] of Object.entries(state.scripts)) {
		if (kind === 'tags' && entry.tags.includes(id)) {
			next = withScript(next, key, { ...entry, tags: entry.tags.filter((t) => t !== id) });
		}
		if (kind === 'folders' && entry.folder === id) {
			next = withScript(next, key, { ...entry, folder: up });
		}
	}
	return next;
}

/** A folder and every folder inside it, at any depth. */
export function folderAndDescendants(state: LibraryLabels, id: string): Set<string> {
	const found = new Set([id]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const f of state.folders) {
			if (f.parent && found.has(f.parent) && !found.has(f.id)) {
				found.add(f.id);
				grew = true;
			}
		}
	}
	return found;
}

/**
 * Moves a folder into another (or to the top level). Refused when the target is the folder
 * itself or inside it, or already holds a folder of that name.
 */
export function moveFolder(
	state: LibraryLabels,
	id: string,
	parent: string | undefined
): LibraryLabels {
	const folder = state.folders.find((f) => f.id === id);
	if (!folder || folder.parent === parent) return state;
	if (parent !== undefined) {
		if (!state.folders.some((f) => f.id === parent)) return state;
		if (folderAndDescendants(state, id).has(parent)) return state;
	}
	if (!nameFree(siblings(state, 'folders', parent), folder.name, id)) return state;
	return {
		...state,
		folders: state.folders.map((f) =>
			f.id === id ? (parent ? { ...f, parent } : { id: f.id, name: f.name }) : f
		)
	};
}

/** The folders directly inside `parent` (the top level when none), by name. */
export function childFolders(state: LibraryLabels, parent: string | undefined): Label[] {
	return byName(state.folders.filter((f) => f.parent === parent));
}

/** The folders from the top level down to `id`, for a breadcrumb; empty when it is gone. */
export function folderPath(state: LibraryLabels, id: string | undefined): Label[] {
	const path: Label[] = [];
	const seen = new Set<string>();
	let at = id;
	while (at !== undefined && !seen.has(at)) {
		seen.add(at);
		const folder = state.folders.find((f) => f.id === at);
		if (!folder) return [];
		path.unshift(folder);
		at = folder.parent;
	}
	return path;
}

/** Every folder in file-manager order (each one followed by what it holds), with its depth. */
export function folderTree(state: LibraryLabels): { folder: Label; depth: number }[] {
	const out: { folder: Label; depth: number }[] = [];
	const walk = (parent: string | undefined, depth: number) => {
		for (const folder of childFolders(state, parent)) {
			out.push({ folder, depth });
			walk(folder.id, depth + 1);
		}
	};
	walk(undefined, 0);
	return out;
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
	return withScript(state, key, { ...entry, folder });
}

/** Renames an item in the Library; a blank name goes back to its own. */
export function setName(state: LibraryLabels, key: string, name: string): LibraryLabels {
	return withScript(state, key, { ...labelsFor(state, key), name });
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
	// A folder's scripts include those in the folders inside it.
	const inFolder =
		filter.folder.kind === 'folder' ? folderAndDescendants(state, filter.folder.id) : new Set();
	return rows.filter((row) => {
		if (term && !row.haystack.includes(term)) return false;
		const entry = labelsFor(state, row.key);
		if (filter.folder.kind === 'none' && entry.folder) return false;
		if (filter.folder.kind === 'folder' && !(entry.folder && inFolder.has(entry.folder)))
			return false;
		return filter.tags.every((tag) => entry.tags.includes(tag));
	});
}

/** Labels sorted by name, the way lists of them are shown. */
export function byName(labels: readonly Label[]): Label[] {
	return [...labels].sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
	);
}
