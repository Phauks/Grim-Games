/**
 * Back to town on phones that are locked or have the app closed (plan U12): each phone that
 * turns the alerts on gives the room its push address (web-push.ts), and a call goes to every
 * such phone that isn't showing the app. A phone showing it hears the call on its socket.
 */
import type { PushAddress } from './web-push.ts';

/** What the room pushes; the service worker shows it as a notification (src/service-worker.ts). */
export interface PushMessage {
	type: 'call-town';
	/** The room's code, so a tap opens that room's player screen. */
	code?: string;
}

/**
 * A call is about now: a phone out of signal for longer than this would only hear it late, so
 * the push service drops it then.
 */
export const CALL_TOWN_PUSH_TTL_SECONDS = 5 * 60;

/** The room keeps one push address per phone, by member. */
export type PushAddresses = Record<string, PushAddress>;

/** Sets or (with no address) forgets member `id`'s push address. */
export function setPushAddress(
	addresses: PushAddresses,
	id: string,
	address: PushAddress | undefined
): PushAddresses {
	const { [id]: old, ...others } = addresses;
	if (!address) return old ? others : addresses;
	if (old?.endpoint === address.endpoint && old.keys.auth === address.keys.auth) return addresses;
	return { ...others, [id]: address };
}

/** Who a Back to town call is pushed to: every phone with an address that isn't showing the app. */
export function pushTargets(
	addresses: PushAddresses,
	showing: ReadonlySet<string>
): [string, PushAddress][] {
	return Object.entries(addresses).filter(([id]) => !showing.has(id));
}
