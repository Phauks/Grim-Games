import { untrack } from 'svelte';
import { account } from '#lib/features/account/account.svelte.ts';
import { firstSignIn } from '#lib/features/account/first-sign-in.svelte.ts';
import { accountSync } from '#lib/features/account/sync/sync.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { writeStored } from '#lib/ui/stored.ts';
import { linkedTo, markLinked } from './library-sync.ts';
import {
	addLabel,
	deleteLabel,
	emptyLabels,
	labelsFor,
	labelsToOffer,
	mergeLabels,
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

/**
 * Synced with a signed-in account as one document (account sync, agreed with the Accounts
 * thread 2026-10-18); when two devices both changed it, the changes are merged.
 */
const KIND = 'library-labels';
const DOC_ID = 'labels';
const LINKED_KEY = 'grim-games:library-labels-linked';
/** This device's labels from before it followed an account whose sheet said no (kept, not deleted). */
const SET_ASIDE_KEY = 'grim-games:library-labels-before-sync';

accountSync.register(KIND, {
	merge: (base, mine, theirs) => {
		const theirLabels = parseLabels(theirs);
		// From a newer build: left as it is.
		if (!theirLabels) return theirs;
		return mergeLabels(
			base === undefined ? undefined : parseLabels(base),
			parseLabels(mine) ?? emptyLabels(),
			theirLabels
		);
	}
});

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

	constructor() {
		if (typeof window === 'undefined') return;
		$effect.root(() => {
			$effect(() => {
				const user = account.user;
				if (!user || !accountSync.ready || !accountSync.enabled(KIND)) return;
				const doc = accountSync.docs(KIND).find((d) => d.id === DOC_ID);
				const pulled = accountSync.pulled;
				// Runs again once a change made here is queued.
				if (this.#pending) return;
				untrack(() => this.#follow(user.id, doc?.body, pulled));
			});
		});
	}

	/** A change made here that the account's copy on this device doesn't show yet. */
	#pending = $state.raw<LibraryLabels | undefined>();

	/** Sends a change made here; until it is queued, the account's older copy is not taken. */
	#push(next: LibraryLabels): void {
		this.#pending = next;
		void accountSync.save(KIND, DOC_ID, next).finally(() => {
			if (this.#pending === next) this.#pending = undefined;
		});
	}

	/** The account's copy on this device: undefined when it has none, null when unreadable. */
	#theirs(): LibraryLabels | undefined | null {
		const body = accountSync.docs(KIND).find((d) => d.id === DOC_ID)?.body;
		return body === undefined ? undefined : (parseLabels(body) ?? null);
	}

	/** What the first sign-in sheet offers: this device's labels the account doesn't have. */
	offerCount(): number {
		const theirs = this.#theirs();
		return theirs === null ? 0 : labelsToOffer(this.#state, theirs);
	}

	/** The sheet said yes: this device's labels and the account's are merged. */
	join(userId: string): void {
		const theirs = this.#theirs();
		if (theirs === null) return;
		const merged = theirs ? mergeLabels(undefined, this.#state, theirs) : this.#state;
		this.#save(merged, { fromAccount: true });
		// Nothing here yet and nothing in the account: no empty document is made.
		const blank = !theirs && JSON.stringify(merged) === JSON.stringify(emptyLabels());
		if (!blank && (!theirs || JSON.stringify(theirs) !== JSON.stringify(merged))) {
			this.#push(merged);
		}
		markLinked(LINKED_KEY, userId);
	}

	/** The sheet said no: this device's labels are set aside and the account's are shown. */
	setAside(userId: string): void {
		const theirs = this.#theirs();
		if (theirs === null) return;
		if (this.#stored.writable && !writeStored(SET_ASIDE_KEY, this.#state)) return;
		this.#save(theirs ?? emptyLabels(), { fromAccount: true });
		markLinked(LINKED_KEY, userId);
	}

	/** Keeps this device in step with the signed-in account's copy (`body`, if it has one). */
	#follow(userId: string, body: unknown, pulled: boolean): void {
		const theirs = body === undefined ? undefined : parseLabels(body);
		if (!linkedTo(LINKED_KEY, userId)) {
			// Until the account's copy has been fetched, an empty account can't be told apart.
			if (!pulled) return;
			if (body !== undefined && !theirs) return;
			// Something to add waits for the first sign-in sheet's answer (Accounts, 2026-10-19),
			// unless the sheet was answered before it offered labels.
			if (this.offerCount() > 0 && !firstSignIn.answered(userId)) return;
			this.join(userId);
			return;
		}
		if (theirs && JSON.stringify(theirs) !== JSON.stringify(this.#state)) {
			this.#save(theirs, { fromAccount: true });
		}
	}

	#save(next: LibraryLabels, { fromAccount = false } = {}): void {
		if (next === this.#state) return;
		this.#state = next;
		const user = account.user;
		// Before this device has joined the account, its changes stay here.
		if (!fromAccount && user && this.#stored.writable && accountSync.enabled(KIND)) {
			if (linkedTo(LINKED_KEY, user.id)) this.#push(next);
		}
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

firstSignIn.register(KIND, {
	async count() {
		return libraryLabels.offerCount();
	},
	async upload() {
		if (account.user) libraryLabels.join(account.user.id);
	},
	async skip() {
		if (account.user) libraryLabels.setAside(account.user.id);
	}
});
