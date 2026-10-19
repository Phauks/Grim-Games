import { untrack } from 'svelte';
import { account } from '#lib/features/account/account.svelte.ts';
import type { ProfileDoc } from '#lib/features/account/account-protocol.ts';
import { accountSync } from '#lib/features/account/sync/sync.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { linkedTo, markLinked } from './library-sync.ts';
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

/**
 * Synced with a signed-in account, one document per collection (account sync, agreed with
 * the Accounts thread 2026-10-18). A collection changed on two devices is kept twice, this
 * device's copy renamed. A document's body is a one-collection `Collections`, so it is read
 * (and migrated) like what this device stores.
 */
const KIND = 'collection';
const LINKED_KEY = 'grim-games:library-collections-linked';

const body = (collection: CharacterCollection): Collections => ({
	...emptyCollections(),
	collections: [collection]
});
const fromDoc = (doc: ProfileDoc): CharacterCollection | undefined => {
	const read = parseCollections(doc.body)?.collections[0];
	return read && read.id === doc.id ? read : undefined;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

accountSync.register(KIND, {
	copy: (raw) => {
		const read = parseCollections(raw)?.collections[0];
		return read ? body({ ...read, name: t('account.sync.otherDevice', { name: read.name }) }) : raw;
	}
});

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

	constructor() {
		if (typeof window === 'undefined') return;
		$effect.root(() => {
			$effect(() => {
				const user = account.user;
				if (!user || !accountSync.ready || !accountSync.enabled(KIND)) return;
				const docs = accountSync.docs(KIND);
				const pulled = accountSync.pulled;
				// Runs again once changes made here are queued.
				if (this.#pending > 0) return;
				untrack(() => this.#follow(user.id, docs, pulled));
			});
		});
	}

	/** Changes made here that the account's copy on this device doesn't show yet. */
	#pending = $state(0);

	/** Keeps this device in step with the signed-in account's collections. */
	#follow(userId: string, docs: ProfileDoc[], pulled: boolean): void {
		const theirs = docs.flatMap((doc) => fromDoc(doc) ?? []);
		// One from a newer build is left alone, and so is the whole list until this build can read it.
		if (theirs.length < docs.length) return;
		if (!linkedTo(LINKED_KEY, userId)) {
			if (!pulled) return;
			const ids = new Set(theirs.map((c) => c.id));
			const mine = this.#state.collections.filter((c) => !ids.has(c.id));
			for (const c of mine) this.#push(c.id, c);
			this.#save({ ...this.#state, collections: [...mine, ...theirs] }, { fromAccount: true });
			markLinked(LINKED_KEY, userId);
			return;
		}
		const order = new Map(this.#state.collections.map((c, i) => [c.id, i]));
		const next = [...theirs].sort(
			(a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity)
		);
		if (!same(next, this.#state.collections)) {
			this.#save({ ...this.#state, collections: next }, { fromAccount: true });
		}
	}

	#push(id: string, collection: CharacterCollection | undefined): void {
		this.#pending++;
		const sent = collection
			? accountSync.save(KIND, id, body(collection))
			: accountSync.remove(KIND, id);
		void sent.finally(() => this.#pending--);
	}

	#save(next: Collections, { fromAccount = false } = {}): void {
		if (next === this.#state) return;
		const before = this.#state;
		this.#state = next;
		if (!fromAccount && account.user && this.#stored.writable && accountSync.enabled(KIND)) {
			const old = new Map(before.collections.map((c) => [c.id, c]));
			for (const c of next.collections) if (!same(old.get(c.id), c)) this.#push(c.id, c);
			const kept = new Set(next.collections.map((c) => c.id));
			for (const id of old.keys()) if (!kept.has(id)) this.#push(id, undefined);
		}
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
