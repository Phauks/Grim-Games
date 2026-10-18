/**
 * "Check for updates" in About (Trevor, 2026-10-18): asks the service worker for a newer
 * build now instead of waiting for the half-hourly check. A build it finds waits behind the
 * usual update card (UpdateBanner), so a running game is never interrupted.
 */
export type UpdateCheck = 'idle' | 'checking' | 'current' | 'ready' | 'failed' | 'unsupported';

class UpdateChecker {
	result = $state<UpdateCheck>('idle');
	/** Bumped when a check finds a build, so a card the user put off with Later shows again. */
	found = $state(0);

	async check(): Promise<UpdateCheck> {
		this.result = 'checking';
		this.result = await findUpdate();
		if (this.result === 'ready') this.found++;
		return this.result;
	}
}

async function findUpdate(): Promise<UpdateCheck> {
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
