/**
 * "Notify me of game invites" on Friends (plan F8): this device's push address, kept on the
 * signed-in account, so a friend's invite reaches the phone with the app closed. Off until
 * turned on, per account and device; invites only (Trevor: friends must not be spammy).
 */
import { account } from '#lib/features/account/account.svelte.ts';
import { call } from '#lib/features/account/account-api.ts';
import { devicePush, type PushBlocked } from '#lib/features/push/device-push.svelte.ts';
import { FRIEND_PUSH_API, type InvitePushState } from './friends-protocol.ts';

class InvitePush {
	/** Whether the signed-in account notifies this device of invites. */
	on = $state(false);
	/** The endpoint the account was given, to swap when the device's address changes. */
	#endpoint: string | undefined;
	/** Bumped when the account changes, so an answer for the previous one is dropped. */
	#generation = 0;

	/** The account signed in when last seen. */
	#user: string | undefined;

	constructor() {
		account.onChange((user) => {
			// Signed out, or another account: the device's address stops working, so the account
			// that turned this on reaches this device no more (it forgets the address then).
			if (this.#user && this.#user !== user?.id && devicePush.has('invites')) {
				void devicePush.release('invites');
			}
			this.#user = user?.id;
			this.#generation++;
			this.on = false;
			this.#endpoint = undefined;
			void this.refresh();
		});
		// Off, the device's subscription may only now have been read: ask again.
		devicePush.listen(() => void (this.on ? this.#follow() : this.refresh()));
	}

	get blocked(): PushBlocked | undefined {
		return devicePush.blocked;
	}

	/** Asks the account whether this device is on its list (Friends opening). */
	async refresh(): Promise<void> {
		const address = devicePush.address;
		const started = this.#generation;
		if (account.status !== 'signed-in' || !address || !devicePush.has('invites')) {
			this.on = false;
			return;
		}
		try {
			const state = await call<InvitePushState>(FRIEND_PUSH_API, 'POST', {
				endpoint: address.endpoint
			});
			if (started !== this.#generation) return;
			this.on = state.on;
			this.#endpoint = state.on ? address.endpoint : undefined;
		} catch {
			// Offline or an older Worker: shown as it was.
		}
	}

	/**
	 * Subscribes this device and gives the account its address. Asks the browser, so call it
	 * from a tap. False when the browser or the server refused.
	 */
	async turnOn(): Promise<boolean> {
		const address = await devicePush.claim('invites');
		// A question asked as the device subscribed is answered by this instead.
		this.#generation++;
		if (!address) return false;
		try {
			await call<InvitePushState>(FRIEND_PUSH_API, 'PUT', { on: true, address });
		} catch {
			await devicePush.release('invites', true);
			return false;
		}
		this.on = true;
		this.#endpoint = address.endpoint;
		return true;
	}

	/** The account forgets this device, and the device's subscription goes unless Back to town has it. */
	async turnOff(): Promise<void> {
		const endpoint = this.#endpoint ?? devicePush.address?.endpoint;
		this.#generation++;
		this.on = false;
		this.#endpoint = undefined;
		try {
			if (endpoint) await call(FRIEND_PUSH_API, 'PUT', { on: false, endpoint });
			await devicePush.release('invites', true);
		} catch {
			// The account keeps the address: let the device's go, so pushes to it stop working.
			await devicePush.release('invites');
		}
	}

	/** The device's address changed while on (Back to town let go of it): the account swaps it. */
	async #follow(): Promise<void> {
		const address = devicePush.address;
		const old = this.#endpoint;
		if (!this.on || !old || address?.endpoint === old) return;
		if (!address || !devicePush.has('invites')) {
			this.on = false;
			this.#endpoint = undefined;
			return;
		}
		this.#endpoint = address.endpoint;
		try {
			await call(FRIEND_PUSH_API, 'PUT', { on: true, address });
			await call(FRIEND_PUSH_API, 'PUT', { on: false, endpoint: old });
		} catch {
			// Shown as on; the next Friends visit asks the account again.
		}
	}
}

export const invitePush = new InvitePush();
