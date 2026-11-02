/**
 * Back to town alerts on this phone while it is locked or the app is closed (plan U12). The
 * phone's push subscription is shared with game invites (plan F8, `features/push/`); this is
 * the Back to town use of it. The room this phone is in is given the address (RoomPlayer), and
 * the service worker shows the call.
 */
import type { PushAddress } from '#lib/core/sync/web-push.ts';
import { devicePush, type PushBlocked } from '#lib/features/push/device-push.svelte.ts';

export type { PushBlocked };

class CallTownPush {
	readonly #listeners = new Set<(address: PushAddress | undefined) => void>();
	#told: PushAddress | undefined;

	constructor() {
		devicePush.listen(() => {
			const address = this.address;
			if (address?.endpoint === this.#told?.endpoint) return;
			this.#told = address;
			for (const listener of this.#listeners) listener(address);
		});
	}

	/** This phone's push address while alerts are on. */
	get address(): PushAddress | undefined {
		return devicePush.has('call-town') ? devicePush.address : undefined;
	}

	get blocked(): PushBlocked | undefined {
		return devicePush.blocked;
	}

	get on(): boolean {
		return !this.blocked && devicePush.granted && !!this.address;
	}

	/** Called with the new address (or none) whenever alerts are turned on or off. */
	listen(listener: (address: PushAddress | undefined) => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}

	/** Asks the browser, so call it from a tap (iOS allows the prompt only then). */
	async turnOn(): Promise<boolean> {
		return !!(await devicePush.claim('call-town'));
	}

	/** The room this phone is in forgets the address (listen); others at their next call. */
	async turnOff(): Promise<void> {
		await devicePush.release('call-town');
	}
}

export const callTownPush = new CallTownPush();
