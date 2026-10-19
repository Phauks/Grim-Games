/**
 * "Check for updates" in About (Trevor, 2026-10-18): asks the service worker for a newer
 * build now instead of waiting for the half-hourly check. A build it finds waits behind the
 * usual update card (UpdateBanner), so a running game is never interrupted.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
import { buildInfo } from '#lib/build-info.ts';
import { isPrecacheProgress, percentDone } from './update-progress.ts';
import {
	BUILD_NOTES_PATH,
	changesSince,
	compareUrl,
	parseBuildNotes,
	parseCompare,
	type Changes
} from './update-notes.ts';

/** When this device last finished a check, so About can say "Checked 18:58". */
const CHECKED_KEY = 'grim-games:update-checked';

export type UpdateCheck =
	'idle' | 'checking' | 'downloading' | 'current' | 'ready' | 'failed' | 'unsupported';

class UpdateChecker {
	result = $state<UpdateCheck>('idle');
	/** Bumped when a check finds a build, so a card the user put off with Later shows again. */
	found = $state(0);
	/** Milliseconds since 1970 of the last finished check on this device, if any. */
	checkedAt = $state(readCheckedAt());
	/** While downloading: whole percent of the new build stored, once the worker says. */
	percent = $state<number | undefined>();
	/** While downloading: bytes stored and the build's total, when the build published sizes. */
	bytes = $state<{ done: number; total: number } | undefined>();
	/** A newer build is stored and waits for Refresh, found by a check here or by the update card. */
	ready = $state(false);
	/** Refresh was tapped, so the new build taking over reloads the page instead of offering it. */
	refreshing = false;
	/**
	 * What the waiting build changed, shown by the update card and About (Trevor, 2026-10-19:
	 * "proffer the changes there"); null until fetched, or when offline.
	 */
	changes = $state<Changes | null>(null);
	#loadingChanges: Promise<void> | undefined;

	/** Fetches what the waiting build changed, once per page unless the last try failed. */
	loadChanges(): Promise<void> {
		this.#loadingChanges ??= fetchChanges().then((changes) => {
			this.changes = changes;
			if (!changes) this.#loadingChanges = undefined;
		});
		return this.#loadingChanges;
	}

	/** The download of each new build being followed, so a check and the watcher share one. */
	#downloads = new WeakMap<ServiceWorker, Promise<UpdateCheck>>();
	#watching = false;

	async check(): Promise<UpdateCheck> {
		this.result = 'checking';
		this.percent = undefined;
		this.bytes = undefined;
		const found = await findUpdate();
		return this.#finish(typeof found === 'string' ? found : await this.#follow(found));
	}

	/**
	 * Follows the downloads the browser starts by itself (on launch, on return to the app, the
	 * half-hourly check), so About shows one already under way without a tap on Check for
	 * updates (Trevor, 2026-10-19).
	 */
	watch(registration: ServiceWorkerRegistration): void {
		if (this.#watching) return;
		this.#watching = true;
		const container = navigator.serviceWorker;
		// The new worker reports each file it stores (update-progress.ts).
		container.addEventListener('message', (event: MessageEvent) => {
			// The first install has nothing to replace, so it is not an update download.
			if (!isPrecacheProgress(event.data) || !container.controller) return;
			this.result = 'downloading';
			this.percent = percentDone(event.data);
			const { bytes, totalBytes } = event.data;
			this.bytes =
				bytes !== undefined && totalBytes ? { done: bytes, total: totalBytes } : undefined;
		});
		container.startMessages?.();
		const follow = () => {
			const next = registration.installing;
			if (next && container.controller) void this.#follow(next).then((r) => this.#finish(r));
		};
		follow();
		registration.addEventListener('updatefound', follow);
	}

	/** Waits for a new build to be stored, showing Downloading meanwhile. */
	#follow(next: ServiceWorker): Promise<UpdateCheck> {
		const known = this.#downloads.get(next);
		if (known) return known;
		const isUpdate = () => !!navigator.serviceWorker.controller;
		const download = (async (): Promise<UpdateCheck> => {
			if (next.state === 'installing' || next.state === 'parsed') {
				if (isUpdate() && this.result !== 'downloading') this.result = 'downloading';
				const state = await new Promise<ServiceWorkerState>((done) => {
					const onChange = () => {
						if (next.state !== 'installing' && next.state !== 'parsed') {
							next.removeEventListener('statechange', onChange);
							done(next.state);
						}
					};
					next.addEventListener('statechange', onChange);
					onChange();
				});
				if (state === 'redundant') return 'failed';
			}
			return isUpdate() ? 'ready' : 'current';
		})();
		this.#downloads.set(next, download);
		return download;
	}

	#finish(result: UpdateCheck): UpdateCheck {
		this.result = result;
		this.percent = undefined;
		this.bytes = undefined;
		if (result === 'ready') {
			this.found++;
			this.ready = true;
		}
		if (result === 'ready' || result === 'current') {
			this.checkedAt = Date.now();
			writeStoredText(CHECKED_KEY, String(this.checkedAt));
		}
		return result;
	}

	/**
	 * Moves this page onto the waiting build: the update card's Refresh and About's (Trevor,
	 * 2026-10-19: "once update has been loaded from about, also add a refresh button there").
	 */
	async refresh(): Promise<void> {
		const container = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
		const registration = await container?.getRegistration?.().catch(() => undefined);
		const waiting = registration?.waiting;
		// Nothing waiting: Refresh in another tab already activated it, so only this page is behind.
		if (!container || !waiting) return location.reload();
		this.refreshing = true;
		container.addEventListener('controllerchange', () => location.reload(), { once: true });
		waiting.postMessage({ type: 'SKIP_WAITING' });
	}
}

function readCheckedAt(): number | undefined {
	const at = Number(readStoredText(CHECKED_KEY));
	return Number.isFinite(at) && at > 0 ? at : undefined;
}

/** The check's result, or the new build it found being stored. */
async function findUpdate(): Promise<UpdateCheck | ServiceWorker> {
	if (!('serviceWorker' in navigator)) return 'unsupported';
	const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
	if (!registration) return 'unsupported';
	// The first install has nothing to replace, so only a page with a controller can update.
	if (registration.waiting) return navigator.serviceWorker.controller ? 'ready' : 'current';
	try {
		await registration.update();
	} catch {
		return 'failed';
	}
	return registration.installing ?? registration.waiting ?? 'current';
}

/** The commits since the running build, from the newest build's notes, else GitHub. */
async function fetchChanges(): Promise<Changes | null> {
	try {
		// Past every cache: the network has the newest build's notes, the one waiting.
		const response = await fetch(BUILD_NOTES_PATH, { cache: 'no-store' });
		const notes = response.ok ? parseBuildNotes(await response.json()) : null;
		if (!notes) return null;
		const fromNotes = changesSince(notes, buildInfo.commit);
		return fromNotes.complete
			? fromNotes
			: ((await compareOnGitHub(buildInfo.commit, notes.commit)) ?? fromNotes);
	} catch {
		return null;
	}
}

/** The commits between two builds from GitHub, or null if it can't be reached. */
async function compareOnGitHub(running: string, next: string): Promise<Changes | null> {
	try {
		const response = await fetch(compareUrl(running, next));
		return response.ok ? parseCompare(await response.json()) : null;
	} catch {
		return null;
	}
}

export const updateCheck = new UpdateChecker();
