/**
 * What the Library holds, like files in a file manager (Trevor, 2026-10-18: "designate files
 * as scripts, characters, or character collections"). Every item has a kind and a key; its
 * folder and tags live in the labels (library-labels.ts) under that key, whatever its kind.
 */
import { folderAndDescendants, labelsFor, type LibraryLabels } from './library-labels.ts';

export const ITEM_KINDS = ['script', 'character', 'collection'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
/** The sidebar's kind choice: every kind, or one. */
export type KindFilter = 'all' | ItemKind;

/** A character saved in the Character builder, by its saved id. */
export const characterKey = (savedId: string) => `character:${savedId}`;
/** A character collection, by its id. */
export const collectionKey = (id: string) => `collection:${id}`;

export interface LibraryItem {
	key: string;
	kind: ItemKind;
	name: string;
	/** Lower-cased searchable text. */
	haystack: string;
}

export interface ItemFilter {
	/** The open folder; the top level when none. */
	folder: string | undefined;
	kind: KindFilter;
	/** Items carrying every one of these tags. */
	tags: readonly string[];
	term: string;
}

/**
 * Whether the view lists one folder's own contents (with its folders), as a file manager
 * does, or a search's flat list from the folder and every folder inside it.
 */
export function isBrowsing(filter: ItemFilter): boolean {
	return filter.term.trim() === '' && filter.kind === 'all' && filter.tags.length === 0;
}

/** The items to show for the sidebar's and search's choices. */
export function itemsShown<T extends LibraryItem>(
	items: readonly T[],
	state: LibraryLabels,
	filter: ItemFilter
): T[] {
	if (isBrowsing(filter)) {
		return items.filter((item) => labelsFor(state, item.key).folder === filter.folder);
	}
	const term = filter.term.trim().toLocaleLowerCase();
	const inside = filter.folder ? folderAndDescendants(state, filter.folder) : undefined;
	return items.filter((item) => {
		if (filter.kind !== 'all' && item.kind !== filter.kind) return false;
		if (term && !item.haystack.includes(term)) return false;
		const labels = labelsFor(state, item.key);
		if (inside && !(labels.folder && inside.has(labels.folder))) return false;
		return filter.tags.every((tag) => labels.tags.includes(tag));
	});
}

/** How many items and folders sit directly in a folder. */
export function folderSize(
	items: readonly LibraryItem[],
	state: LibraryLabels,
	folder: string
): number {
	return (
		state.folders.filter((f) => f.parent === folder).length +
		items.filter((item) => labelsFor(state, item.key).folder === folder).length
	);
}
