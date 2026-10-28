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
const LIBRARY_LABELS_VERSION = 2;
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

/** `base`, or the first of "base 2", "base 3"... not taken among `labels` (a new folder's name). */
export function freeName(labels: readonly Label[], base: string): string {
	for (let n = 1; ; n++) {
		const name = n === 1 ? base : `${base} ${n}`;
		if (nameFree(labels, name)) return name;
	}
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
/**
 * Why a folder can't move into `parent` (the top level when none): a folder can't go inside
 * itself or one of its own folders, and two folders side by side never share a name. Undefined
 * when it can, or when it is already there.
 */
export function folderMoveProblem(
	state: LibraryLabels,
	id: string,
	parent: string | undefined
): 'inside' | 'nameTaken' | undefined {
	const folder = state.folders.find((f) => f.id === id);
	if (!folder || folder.parent === parent) return undefined;
	if (parent !== undefined && folderAndDescendants(state, id).has(parent)) return 'inside';
	if (!nameFree(siblings(state, 'folders', parent), folder.name, id)) return 'nameTaken';
	return undefined;
}

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

/** Gives another item this one's folder and tags (an item whose kind changed). */
export function moveLabels(state: LibraryLabels, from: string, to: string): LibraryLabels {
	const { folder, tags } = labelsFor(state, from);
	const next = withScript(state, to, { ...labelsFor(state, to), folder, tags });
	return withScript(next, from, { tags: [] });
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

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One value changed on two devices: the side that changed it wins; when both did, an edit beats a delete, then this device. */
function pickChanged<T>(
	base: T | undefined,
	mine: T | undefined,
	theirs: T | undefined
): T | undefined {
	if (sameValue(mine, base)) return theirs;
	if (sameValue(theirs, base)) return mine;
	return mine ?? theirs;
}

/** Keeps what both have, plus what either added; drops what either took away. */
function mergeSet(
	base: readonly string[],
	mine: readonly string[],
	theirs: readonly string[]
): string[] {
	const was = new Set(base);
	const other = new Set(theirs);
	const kept = mine.filter((x) => other.has(x) || !was.has(x));
	return [...kept, ...theirs.filter((x) => !was.has(x) && !kept.includes(x))];
}

function mergeById(
	base: readonly Label[],
	mine: readonly Label[],
	theirs: readonly Label[]
): Label[] {
	const byId = (list: readonly Label[]) => new Map(list.map((l) => [l.id, l]));
	const [b, m, t] = [byId(base), byId(mine), byId(theirs)];
	const ids = [...new Set([...m.keys(), ...t.keys(), ...b.keys()])];
	return ids.flatMap((id) => {
		const label = pickChanged(b.get(id), m.get(id), t.get(id));
		return label ? [label] : [];
	});
}

/** Two folders or tags side by side with one name (made on two devices): the later one gets a number. */
function uniqueNames(labels: Label[], kind: LabelKind): Label[] {
	const out: Label[] = [];
	for (const label of labels) {
		const near = kind === 'tags' ? out : out.filter((l) => l.parent === label.parent);
		let name = label.name;
		for (let n = 2; !nameFree(near, name); n++) name = `${label.name} ${n}`;
		out.push(name === label.name ? label : { ...label, name });
	}
	return out;
}

/**
 * Two devices' labels combined (account sync; agreed with the Accounts thread, 2026-10-18):
 * folders, tags and each item's labels are merged one by one from `base`, the copy both
 * started from (none when the account had none yet). A change on one side is kept; a delete
 * wins only over something the other side left alone; when both changed the same thing, this
 * device's change wins. Folder loops and names used twice are repaired.
 */
export function mergeLabels(
	base: LibraryLabels | undefined,
	mine: LibraryLabels,
	theirs: LibraryLabels
): LibraryLabels {
	const b = base ?? emptyLabels();
	const scripts: Record<string, ScriptLabels> = {};
	const none: ScriptLabels = { tags: [] };
	for (const key of new Set([...Object.keys(mine.scripts), ...Object.keys(theirs.scripts)])) {
		const [was, m, t] = [
			b.scripts[key] ?? none,
			mine.scripts[key] ?? none,
			theirs.scripts[key] ?? none
		];
		const folder = pickChanged(was.folder, m.folder, t.folder);
		const name = pickChanged(was.name, m.name, t.name);
		scripts[key] = {
			tags: mergeSet(was.tags, m.tags, t.tags),
			...(folder ? { folder } : {}),
			...(name ? { name } : {})
		};
	}
	const merged = parseLabels({
		version: LIBRARY_LABELS_VERSION,
		tags: mergeById(b.tags, mine.tags, theirs.tags),
		folders: mergeById(b.folders, mine.folders, theirs.folders),
		scripts
	});
	if (!merged) return mine;
	return {
		...merged,
		tags: uniqueNames(merged.tags, 'tags'),
		folders: uniqueNames(merged.folders, 'folders')
	};
}

/**
 * How many of this device's folders, tags and item labels the account's copy doesn't have:
 * what the first sign-in sheet offers to add (Accounts thread, 2026-10-19).
 */
export function labelsToOffer(mine: LibraryLabels, theirs: LibraryLabels | undefined): number {
	const has = (list: Label[] | undefined, id: string) => !!list?.some((l) => l.id === id);
	const folders = mine.folders.filter((f) => !has(theirs?.folders, f.id)).length;
	const tags = mine.tags.filter((tag) => !has(theirs?.tags, tag.id)).length;
	const items = Object.entries(mine.scripts).filter(
		([key, labels]) => JSON.stringify(theirs?.scripts[key]) !== JSON.stringify(labels)
	).length;
	return folders + tags + items;
}
