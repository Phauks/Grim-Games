/**
 * "Check for updates" in About (Trevor, 2026-10-18): asks the service worker for a newer
 * build now instead of waiting for the half-hourly check. A build it finds waits behind the
 * usual update card (UpdateBanner), so a running game is never interrupted.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
import { isPrecacheProgress, percentDone } from './update-progress.ts';

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

	async check(): Promise<UpdateCheck> {
		this.result = 'checking';
		this.percent = undefined;
		this.bytes = undefined;
		// The new worker reports each file it stores (update-progress.ts).
		const onMessage = (event: MessageEvent) => {
			if (!isPrecacheProgress(event.data)) return;
			this.result = 'downloading';
			this.percent = percentDone(event.data);
			const { bytes, totalBytes } = event.data;
			this.bytes =
				bytes !== undefined && totalBytes ? { done: bytes, total: totalBytes } : undefined;
		};
		const container = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
		container?.addEventListener('message', onMessage);
		container?.startMessages?.();
		try {
			this.result = await findUpdate(() => {
				if (this.result === 'checking') this.result = 'downloading';
			});
		} finally {
			container?.removeEventListener('message', onMessage);
			this.percent = undefined;
			this.bytes = undefined;
		}
		if (this.result === 'ready') this.found++;
		if (this.result === 'ready' || this.result === 'current') {
			this.checkedAt = Date.now();
			writeStoredText(CHECKED_KEY, String(this.checkedAt));
		}
		return this.result;
	}
}

function readCheckedAt(): number | undefined {
	const at = Number(readStoredText(CHECKED_KEY));
	return Number.isFinite(at) && at > 0 ? at : undefined;
}

/** `onDownload` runs once a newer build has been found and is being stored. */
async function findUpdate(onDownload: () => void): Promise<UpdateCheck> {
	if (!('serviceWorker' in navigator)) return 'unsupported';
	const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
	if (!registration) return 'unsupported';
	// The first install has nothing to replace, so only a page with a controller can update.
	const isUpdate = () => !!navigator.serviceWorker.controller;
	if (registration.waiting) return isUpdate() ? 'ready' : 'current';
	try {
		await registration.update();
	} catch {
		return 'failed';
	}
	const next = registration.installing ?? registration.waiting;
	if (!next) return 'current';
	if (next.state !== 'installed') {
		onDownload();
		const state = await new Promise<ServiceWorkerState>((done) => {
			const onChange = () => {
				if (next.state === 'installed' || next.state === 'redundant') {
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
}

export const updateCheck = new UpdateChecker();
