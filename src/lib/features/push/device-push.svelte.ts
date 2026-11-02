/**
 * This device's one push subscription, shared by everything that alerts with the app closed:
 * Back to town (plan U12, `features/room/call-town-push.svelte.ts`) and game invites (plan F8,
 * `features/friends/invite-push.svelte.ts`). A browser keeps one subscription per app, so each
 * use claims it and lets it go; it is cancelled only once no use wants it, and turning one on
 * never turns the other on.
 */
import { parsePushAddress, type PushAddress } from '#lib/core/sync/web-push.ts';
import { needsHomeScreen, thisBrowser } from '#lib/features/settings/data/keep-data.ts';
import { readStored, writeStored } from '#lib/ui/stored.ts';
import { fetchJson } from '#lib/ui/fetch.ts';

/** Why a push switch can't be turned on here; undefined when it can. */
export type PushBlocked = 'home-screen' | 'unsupported' | 'denied';

/** What this device's subscription is for. */
export type PushUse = 'call-town' | 'invites';

const USES_KEY = 'grim-games:push-uses';

/**
 * The uses stored on this device. Before game invites (plan F8) nothing was stored, and a
 * subscription meant Back to town was on, so one found then counts as that.
 */
export function parsePushUses(raw: unknown, subscribed: boolean): PushUse[] {
	if (!Array.isArray(raw)) return subscribed ? ['call-town'] : [];
	return raw.filter((use): use is PushUse => use === 'call-town' || use === 'invites');
}

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

class DevicePush {
	/** This device's push address while any use has it. */
	address = $state.raw<PushAddress>();
	#uses = $state.raw<PushUse[]>([]);
	#permission = $state<NotificationPermission>(canPush() ? Notification.permission : 'default');
	readonly #listeners = new Set<() => void>();

	constructor() {
		if (!canPush()) return;
		// Read once the app is running, and never in its way: a throw here would stop every
		// screen that imports this from loading.
		queueMicrotask(async () => {
			try {
				const registration = await navigator.serviceWorker.getRegistration();
				const subscription = (await registration?.pushManager?.getSubscription()) ?? undefined;
				this.#uses = parsePushUses(readStored(USES_KEY), !!subscription);
				this.#set(subscription);
			} catch {
				// No service worker yet: every use shows as off.
			}
		});
	}

	get blocked(): PushBlocked | undefined {
		if (!canPush()) return needsHomeScreen(thisBrowser()) ? 'home-screen' : 'unsupported';
		if (this.#permission === 'denied') return 'denied';
		return undefined;
	}

	get granted(): boolean {
		return this.#permission === 'granted';
	}

	/** Whether `use` has this device's subscription. */
	has(use: PushUse): boolean {
		return this.#uses.includes(use);
	}

	/** Called whenever the address or a use changes. */
	listen(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/**
	 * Subscribes this device for `use` and returns its address, or undefined when the browser
	 * refused. Asks the browser, so call it from a tap (iOS allows the prompt only then).
	 */
	async claim(use: PushUse): Promise<PushAddress | undefined> {
		if (this.blocked) return undefined;
		try {
			this.#permission = await Notification.requestPermission();
			if (this.#permission !== 'granted') return undefined;
			const registration = await navigator.serviceWorker.ready;
			const subscription =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: await serverKey()
				}));
			const added = !this.has(use);
			if (added) this.#setUses([...this.#uses, use]);
			this.#set(subscription, added);
			return this.address;
		} catch {
			return undefined;
		}
	}

	/**
	 * `use` lets the subscription go, and its address stops working, so nobody it was given to
	 * (a room, the account) can reach this device for that use any more. When another use still
	 * wants it, the device subscribes again at once, with a new address, which that use hands on
	 * (listen). `forgotten`: everyone given the address for `use` already forgot it (the account,
	 * for invites), so another use keeps the same address.
	 */
	async release(use: PushUse, forgotten = false): Promise<void> {
		const rest = this.#uses.filter((other) => other !== use);
		this.#setUses(rest);
		if (rest.length && forgotten) {
			this.#notify();
			return;
		}
		let next: PushSubscription | undefined;
		try {
			const registration = await navigator.serviceWorker.getRegistration();
			await (await registration?.pushManager.getSubscription())?.unsubscribe();
			if (rest.length && registration && this.granted) {
				next = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: await serverKey()
				});
			}
		} catch {
			// Off here all the same; whoever kept the address forgets it at the next push.
		}
		this.#set(next, true);
	}

	#setUses(uses: PushUse[]): void {
		this.#uses = uses;
		writeStored(USES_KEY, uses);
	}

	#set(subscription: PushSubscription | undefined, changed = false): void {
		const address = subscription ? parsePushAddress(subscription.toJSON()) : undefined;
		if (address?.endpoint !== this.address?.endpoint) {
			this.address = address;
			changed = true;
		}
		if (changed) this.#notify();
	}

	#notify(): void {
		for (const listener of this.#listeners) listener();
	}
}

export const devicePush = new DevicePush();
