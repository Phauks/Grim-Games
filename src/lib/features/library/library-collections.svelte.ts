import { reportError } from '#lib/features/errors/report.svelte.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import {
	addCollection,
	deleteCollection,
	emptyCollections,
	parseCollections,
	renameCollection,
	toggleCharacter,
	type CharacterCollection,
	type Collections
} from './library-collections.ts';

export const COLLECTIONS_STORAGE_KEY = 'grim-games:library-collections';

/** What was stored, and whether it may be written (not when a newer build wrote it). */
function read(): { state: Collections; writable: boolean } {
	const state = parseCollections(readStored(COLLECTIONS_STORAGE_KEY) ?? null);
	return state ? { state, writable: true } : { state: emptyCollections(), writable: false };
}

/** The user's character collections on this device, saved in localStorage on every change. */
class CollectionStore {
	#stored = read();
	#state = $state.raw<Collections>(this.#stored.state);

	get list(): readonly CharacterCollection[] {
		return this.#state.collections;
	}

	get(id: string): CharacterCollection | undefined {
		return this.#state.collections.find((c) => c.id === id);
	}

	#save(next: Collections): void {
		if (next === this.#state) return;
		this.#state = next;
		if (!this.#stored.writable) return;
		if (!writeStored(COLLECTIONS_STORAGE_KEY, next)) {
			// Storage full or blocked: works until the page reloads, so say it wasn't saved.
			reportError(new Error('Character collections were not saved on this device'), {
				area: 'library'
			});
		}
	}

	/** Adds a collection; returns its id, or undefined when the name is blank. */
	add(name: string): string | undefined {
		const id = crypto.randomUUID();
		this.#save(addCollection(this.#state, id, name, Date.now()));
		return this.get(id) ? id : undefined;
	}

	rename(id: string, name: string): void {
		this.#save(renameCollection(this.#state, id, name, Date.now()));
	}

	toggle(id: string, ref: string): void {
		this.#save(toggleCharacter(this.#state, id, ref, Date.now()));
	}

	delete(id: string): void {
		this.#save(deleteCollection(this.#state, id));
	}
}

export const characterCollections = new CollectionStore();
