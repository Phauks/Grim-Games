/**
 * Keeps this device's settings in step with a signed-in account (Trevor, 2026-11-09: settings
 * profiles removed, "sizes per device"): one account document holds the shared settings
 * (synced-values.ts); each device keeps its own sizes. A change made here is sent; a change
 * from another device is laid over this one's settings. The first device to sign in fills the
 * account, and a device that signs in later takes the account's settings.
 */
import { untrack } from 'svelte';
import { account } from '#lib/features/account/account.svelte.ts';
import { accountSync } from '#lib/features/account/sync/sync.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { boardBackground } from '#lib/features/grimoire/board-background.svelte.ts';
import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
import {
	clearBackground,
	saveBackground,
	type BackgroundChoice
} from '#lib/features/grimoire/backgrounds.ts';
import { defaultBackground } from '#lib/features/grimoire/default-background.svelte.ts';
import { stepFocus } from '#lib/features/grimoire/step-focus.svelte.ts';
import { linkedTo, markLinked } from '#lib/features/library/library-sync.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import {
	mergeSynced,
	parseSyncedBody,
	sameValues,
	syncedBody,
	syncedValues,
	withSynced,
	type SyncedValues
} from './synced-values.ts';

const KIND = 'settings';
const DOC_ID = 'settings';
const LINKED_KEY = 'grim-games:settings-linked';

accountSync.register(KIND, {
	merge: (base, mine, theirs) => {
		const theirValues = parseSyncedBody(theirs);
		const myValues = parseSyncedBody(mine);
		// From a newer build: left as it is.
		if (!theirValues || !myValues) return theirs;
		const baseValues = base === undefined ? undefined : parseSyncedBody(base);
		return syncedBody(mergeSynced(baseValues, myValues, theirValues));
	}
});

const live = (): SyncedValues =>
	syncedValues(
		preferences.current,
		boardLooks.current,
		stepFocus.current,
		defaultBackground.current
	);

class SyncedSettings {
	/** The background for all games has been read, so the shared values are whole. */
	#ready = $state(false);
	/** The account's values are being written into this device's settings. */
	#applying = $state(false);
	/** A change sent from here that the account's copy on this device doesn't show yet. */
	#pending = $state(0);
	/** The shared values as last sent or taken, so only a real change is sent. */
	#known: SyncedValues | undefined;
	/** The account's copy as last sent or taken, so each copy is laid over this device once. */
	#seen: string | undefined;

	constructor() {
		if (typeof window === 'undefined') return;
		void defaultBackground.load().finally(() => (this.#ready = true));
		$effect.root(() => {
			// A change made here goes to the account.
			$effect(() => {
				if (!this.#ready || this.#applying) return;
				const values = live();
				untrack(() => this.#changed(values));
			});
			// A change from another device comes here.
			$effect(() => {
				const user = account.user;
				if (!user || !accountSync.ready || !accountSync.enabled(KIND)) return;
				const body = accountSync.docs(KIND).find((d) => d.id === DOC_ID)?.body;
				const pulled = accountSync.pulled;
				if (this.#pending > 0 || !this.#ready || this.#applying) return;
				untrack(() => void this.#follow(user.id, body, pulled));
			});
		});
	}

	#changed(values: SyncedValues): void {
		if (this.#known && sameValues(this.#known, values)) return;
		const first = this.#known === undefined;
		this.#known = values;
		// The settings as this page opened aren't a change: the account may hold newer ones.
		if (first) return;
		const user = account.user;
		if (user && linkedTo(LINKED_KEY, user.id) && accountSync.enabled(KIND)) this.#push(values);
	}

	#push(values: SyncedValues): void {
		const body = syncedBody(values);
		this.#seen = JSON.stringify(body);
		this.#pending++;
		void accountSync.save(KIND, DOC_ID, body).finally(() => this.#pending--);
	}

	async #follow(userId: string, body: unknown, pulled: boolean): Promise<void> {
		const theirs = body === undefined ? undefined : parseSyncedBody(body);
		if (!linkedTo(LINKED_KEY, userId)) {
			// Until the account's copy has been fetched, an empty account can't be told apart.
			if (!pulled || (body !== undefined && !theirs)) return;
			markLinked(LINKED_KEY, userId);
			// The first device to sign in fills the account; later ones take its settings.
			this.#seen = JSON.stringify(body);
			if (theirs) await this.#apply(theirs);
			else this.#push(live());
			return;
		}
		const seen = JSON.stringify(body);
		if (seen === this.#seen) return;
		this.#seen = seen;
		if (theirs && !sameValues(theirs, live())) await this.#apply(theirs);
	}

	/** Lays the account's values over this device's settings, keeping the device's sizes. */
	async #apply(values: SyncedValues): Promise<void> {
		this.#applying = true;
		try {
			const next = withSynced(preferences.current, boardLooks.current, values);
			preferences.update(next.preferences);
			boardLooks.update(next.boardLooks);
			stepFocus.update(next.stepFocus);
			const here = defaultBackground.current;
			if (here?.kind !== values.background.kind || values.background.kind !== 'image') {
				// A picture is only on the device that added it: elsewhere the board is plain.
				const choice: BackgroundChoice | undefined =
					values.background.kind === 'none' || values.background.kind === 'image'
						? undefined
						: values.background;
				if (choice) await saveBackground('default', choice);
				else await clearBackground('default');
				defaultBackground.set(choice);
				boardBackground.context?.onChange();
			}
			this.#known = live();
		} catch (e) {
			reportError(e, { area: 'settings', notify: false });
		} finally {
			this.#applying = false;
		}
	}
}

// Runs once the account starts (account/start.ts imports this module).
new SyncedSettings();
