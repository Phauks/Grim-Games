import { reportError } from '#lib/features/errors/report.svelte.ts';
import {
	addLabel,
	deleteLabel,
	emptyLabels,
	labelsFor,
	moveFolder,
	parseLabels,
	renameLabel,
	setFolder,
	moveLabels,
	setName,
	toggleTag,
	type LabelKind,
	type LibraryLabels,
	type ScriptLabels
} from './library-labels.ts';

export const LIBRARY_STORAGE_KEY = 'grim-games:library';

/** What was stored, and whether it may be written (not when a newer build wrote it). */
function read(): { state: LibraryLabels; writable: boolean } {
	try {
		const raw = globalThis.localStorage?.getItem(LIBRARY_STORAGE_KEY);
		const state = parseLabels(raw ? JSON.parse(raw) : null);
		return state ? { state, writable: true } : { state: emptyLabels(), writable: false };
	} catch (error) {
		// Blocked storage or corrupt JSON: start empty. Logged only; the page still works.
		reportError(error, { area: 'library', notify: false });
		return { state: emptyLabels(), writable: true };
	}
}

/** The user's folders and tags on this device, saved in localStorage on every change. */
class Labels {
	#stored = read();
	#state = $state.raw<LibraryLabels>(this.#stored.state);

	get state(): LibraryLabels {
		return this.#state;
	}

	for(key: string): ScriptLabels {
		return labelsFor(this.#state, key);
	}

	#save(next: LibraryLabels): void {
		if (next === this.#state) return;
		this.#state = next;
		if (!this.#stored.writable) return;
		try {
			globalThis.localStorage?.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
		} catch (error) {
			// Storage full or blocked: works until the page reloads, so say it wasn't saved.
			reportError(error, { area: 'library' });
		}
	}

	/**
	 * Adds a tag, or a folder inside `parent`; returns its id, or undefined when the name is
	 * blank or taken.
	 */
	add(kind: LabelKind, name: string, parent?: string): string | undefined {
		const id = crypto.randomUUID();
		const next = addLabel(this.#state, kind, name, id, parent);
		this.#save(next);
		return next[kind].some((l) => l.id === id) ? id : undefined;
	}

	rename(kind: LabelKind, id: string, name: string): void {
		this.#save(renameLabel(this.#state, kind, id, name));
	}

	delete(kind: LabelKind, id: string): void {
		this.#save(deleteLabel(this.#state, kind, id));
	}

	moveFolder(id: string, parent: string | undefined): void {
		this.#save(moveFolder(this.#state, id, parent));
	}

	setFolder(key: string, folder: string | undefined): void {
		this.#save(setFolder(this.#state, key, folder));
	}

	moveLabels(from: string, to: string): void {
		this.#save(moveLabels(this.#state, from, to));
	}

	setName(key: string, name: string): void {
		this.#save(setName(this.#state, key, name));
	}

	toggleTag(key: string, tag: string): void {
		this.#save(toggleTag(this.#state, key, tag));
	}
}

export const libraryLabels = new Labels();
