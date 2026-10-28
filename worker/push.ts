import { DurableObject } from 'cloudflare:workers';
import { noStore } from './http.ts';
import {
	makePushKeys,
	parsePushAddress,
	publicPushKey,
	pushAddressGone,
	pushRequest,
	type PushAddress,
	type PushKeys
} from '../src/lib/core/sync/web-push.ts';
import {
	CALL_TOWN_PUSH_TTL_SECONDS,
	pushTargets,
	setPushAddress,
	type PushAddresses,
	type PushMessage
} from '../src/lib/core/sync/room-push.ts';

export interface PushEnv {
	PUSH_KEYS: DurableObjectNamespace<PushKeyStore>;
	/** "off" in the local e2e server: no push leaves for a push service. */
	OTHER_SITES?: string;
}

/** Where phones get the key they subscribe with (core/sync/web-push.ts). */
export const PUSH_KEY_API = '/api/push-key';

function keyStore(env: PushEnv) {
	return env.PUSH_KEYS.get(env.PUSH_KEYS.idFromName('vapid'));
}

/**
 * The app's push signing keys (VAPID, RFC 8292), made here the first time they are needed and
 * kept, so there is no secret to set up (plan U12). Each deployment's storage has its own, and
 * a phone's push address only works with the keys it subscribed with.
 */
export class PushKeyStore extends DurableObject {
	async keys(): Promise<PushKeys> {
		const kept = await this.ctx.storage.get<PushKeys>('keys');
		if (kept) return kept;
		const keys = await makePushKeys();
		await this.ctx.storage.put('keys', keys);
		return keys;
	}
}

/** `GET /api/push-key`: the public key phones subscribe with. Undefined for other paths. */
export async function handlePushKey(
	request: Request,
	env: PushEnv,
	url: URL
): Promise<Response | undefined> {
	if (url.pathname !== PUSH_KEY_API) return undefined;
	if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
	const key = await publicPushKey(await keyStore(env).keys());
	return Response.json({ key }, { headers: noStore });
}

/**
 * Pushes `message` to each phone, and returns the members whose address the push service says
 * is gone, for the room to forget. A push that fails otherwise is only missed.
 */
export async function pushToPhones(
	env: PushEnv,
	to: [string, PushAddress][],
	message: PushMessage
): Promise<string[]> {
	if (!to.length || env.OTHER_SITES === 'off') return [];
	const keys = await keyStore(env).keys();
	const body = JSON.stringify(message);
	const gone = await Promise.all(
		to.map(async ([id, address]) => {
			try {
				const { url, init } = await pushRequest(
					address,
					body,
					keys,
					Date.now(),
					CALL_TOWN_PUSH_TTL_SECONDS
				);
				const response = await fetch(url, init);
				return pushAddressGone(response.status) ? id : undefined;
			} catch {
				return undefined;
			}
		})
	);
	return gone.filter((id) => id !== undefined);
}

/**
 * Sets the push address Back to town reaches member `id` at in a room's storage (plan U12), or
 * forgets it when the phone sent none. An address that isn't a push service's is ignored.
 */
export async function setRoomPushAddress(
	storage: DurableObjectStorage,
	id: string,
	sent: unknown
): Promise<void> {
	const address = sent === undefined ? undefined : parsePushAddress(sent);
	if (sent !== undefined && !address) return;
	const addresses = (await storage.get<PushAddresses>('push')) ?? {};
	const next = setPushAddress(addresses, id, address);
	if (next !== addresses) await storage.put('push', next);
}

/** Pushes a room's Back to town call to its phones not `showing` the app, and forgets gone ones. */
export async function pushCallTown(
	env: PushEnv,
	storage: DurableObjectStorage,
	showing: ReadonlySet<string>
): Promise<void> {
	const addresses = (await storage.get<PushAddresses>('push')) ?? {};
	const code = await storage.get<string>('code');
	const gone = await pushToPhones(env, pushTargets(addresses, showing), {
		type: 'call-town',
		...(code ? { code } : {})
	});
	for (const id of gone) await setRoomPushAddress(storage, id, undefined);
}
