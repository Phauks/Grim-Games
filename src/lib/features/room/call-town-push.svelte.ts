/**
 * Back to town alerts on this phone while it is locked or the app is closed (plan U12): the
 * browser's push subscription is the switch, so there is nothing else to keep. The room this
 * phone is in is given the address (RoomPlayer), and the service worker shows the call.
 */
import { parsePushAddress, type PushAddress } from '#lib/core/sync/web-push.ts';
import { needsHomeScreen, thisBrowser } from '#lib/features/settings/data/keep-data.ts';
import { fetchJson } from '#lib/ui/fetch.ts';

/** Why the switch can't be turned on here; undefined when it can. */
export type PushBlocked = 'home-screen' | 'unsupported' | 'denied';

function canPush(): boolean {
	return (
		typeof window !== 'undefined' &&
		'serviceWorker' in navigator &&
		'PushManager' in window &&
		'Notification' in window
	);
}

/** The key phones subscribe with, from the Worker (worker/push.ts). */
async function serverKey(): Promise<string> {
	const { response, body } = await fetchJson('/api/push-key');
	const key = (body as { key?: unknown } | undefined)?.key;
	if (!response.ok || typeof key !== 'string') throw new Error(`Push key: ${response.status}`);
	return key;
}

class CallTownPush {
	/** This phone's push address while alerts are on. */
	address = $state.raw<PushAddress>();
	#permission = $state<NotificationPermission>(canPush() ? Notification.permission : 'default');
	readonly #listeners = new Set<(address: PushAddress | undefined) => void>();

	constructor() {
		if (!canPush()) return;
		void navigator.serviceWorker
			.getRegistration()
			.then((registration) => registration?.pushManager.getSubscription())
			.then((subscription) => this.#set(subscription ?? undefined))
			.catch(() => {});
	}

	get blocked(): PushBlocked | undefined {
		if (!canPush()) return needsHomeScreen(thisBrowser()) ? 'home-screen' : 'unsupported';
		if (this.#permission === 'denied') return 'denied';
		return undefined;
	}

	get on(): boolean {
		return !this.blocked && this.#permission === 'granted' && !!this.address;
	}

	/** Called with the new address (or none) whenever alerts are turned on or off. */
	listen(listener: (address: PushAddress | undefined) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Asks the browser, so call it from a tap (iOS allows the prompt only then). */
	async turnOn(): Promise<boolean> {
		if (this.blocked) return false;
		try {
			this.#permission = await Notification.requestPermission();
			if (this.#permission !== 'granted') return false;
			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: await serverKey()
			});
			this.#set(subscription);
			return !!this.address;
		} catch {
			return false;
		}
	}

	/** The address stops working everywhere, so every room forgets it at its next call. */
	async turnOff(): Promise<void> {
		try {
			const registration = await navigator.serviceWorker.getRegistration();
			await (await registration?.pushManager.getSubscription())?.unsubscribe();
		} catch {
			// Off here all the same, and the room this phone is in forgets the address (listen).
		}
		this.#set(undefined);
	}

	#set(subscription: PushSubscription | undefined): void {
		const address = subscription ? parsePushAddress(subscription.toJSON()) : undefined;
		if (address?.endpoint === this.address?.endpoint) return;
		this.address = address;
		for (const listener of this.#listeners) listener(address);
	}
}

export const callTownPush = new CallTownPush();
