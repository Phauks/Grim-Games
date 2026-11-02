/**
 * Game invite notifications (plan F8): an account that turned on "Notify me of game invites"
 * keeps each such device's push address on its friend book, and a friend's new invite (plan
 * F4) is pushed to them through the app's one push sender (worker/push.ts). Invites only, and
 * nothing until the switch is on. The push carries who sent it and the script's name, never the
 * room code: a tap opens Friends, whose invite has Join.
 */
import {
	FRIEND_PUSH_API,
	type InvitePushState
} from '../../src/lib/features/friends/friends-protocol.ts';
import { INVITE_PUSH_TTL_SECONDS, invitePushMessage } from '../../src/lib/core/sync/invite-push.ts';
import { parsePushAddress, type PushAddress } from '../../src/lib/core/sync/web-push.ts';
import { readBody } from '../account/routes.ts';
import { userStub } from '../account/objects.ts';
import { pushToPhones } from '../push.ts';
import { fail, friendBook, json, type FriendsEnv } from './routes.ts';

/** A push address's endpoint as sent, or undefined. */
function endpointOf(value: unknown): string | undefined {
	return typeof value === 'string' && value.length <= 1024 ? value : undefined;
}

/**
 * The devices `other` gets invite notifications on, unless `from` already has an invite to
 * `code` waiting there (sending it again renews it without a second notification). Empty while
 * the shared data Worker is older than this app.
 */
export async function invitePushTargets(
	env: FriendsEnv,
	other: string,
	from: string,
	code: string
): Promise<PushAddress[]> {
	try {
		const book = friendBook(env, other);
		const waiting = await book.invites(Date.now());
		if (waiting.some((invite) => invite.sender === from && invite.code === code)) return [];
		return await book.invitePushTargets(Date.now());
	} catch {
		return [];
	}
}

/** Pushes `from`'s invite to `other`'s devices, and forgets those the push service says are gone. */
export async function pushInvite(
	env: FriendsEnv,
	other: string,
	from: string,
	title: string,
	to: PushAddress[]
): Promise<void> {
	if (!to.length) return;
	try {
		const sender = await userStub(env, from).profile();
		const message = invitePushMessage(sender?.username ?? null, title);
		const targets = to.map((address) => [address.endpoint, address] as [string, PushAddress]);
		const gone = await pushToPhones(env, targets, message, INVITE_PUSH_TTL_SECONDS);
		if (gone.length) await friendBook(env, other).dropPushDevices(gone);
	} catch {
		// The invite still waits on Friends; only the notification is missed.
	}
}

/** Handles `/api/friends/push` for `accountId`; undefined for any other path. */
export async function handleInvitePush(
	request: Request,
	env: FriendsEnv,
	path: string,
	accountId: string
): Promise<Response | undefined> {
	if (path !== FRIEND_PUSH_API) return undefined;
	if (request.method !== 'PUT' && request.method !== 'POST') return fail(404, 'Not found');
	const body = await readBody(request, 4096);
	const book = friendBook(env, accountId);
	try {
		if (request.method === 'POST') {
			const endpoint = endpointOf(body?.endpoint);
			if (!endpoint) return fail(400, 'Bad push address.');
			return json((await book.pushDevice(endpoint)) satisfies InvitePushState);
		}
		if (body?.on === true) {
			const address = parsePushAddress(body.address);
			if (!address) return fail(400, 'Bad push address.');
			await book.addPushDevice(address, Date.now());
			return json({ on: true } satisfies InvitePushState);
		}
		const endpoint = endpointOf(body?.endpoint);
		if (body?.on !== false || !endpoint) return fail(400, 'Bad push address.');
		await book.dropPushDevices([endpoint]);
		return json({ on: false } satisfies InvitePushState);
	} catch {
		// The shared data Worker is older than this app: there is nowhere to keep it yet.
		return fail(503, 'Not available yet. Try again later.');
	}
}
