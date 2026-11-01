/**
 * Scripts between friends (plan F9, F10): `/api/friends/scripts/*` for the signed-in account,
 * and `/api/profiles/<username>`, the scripts an account publishes, which anyone may read.
 */
import {
	DISMISS_SCRIPT_API,
	FRIEND_SCRIPTS_API,
	parseProfilePath,
	PUBLISH_SCRIPT_API,
	isLastingHash,
	readFriendScript,
	SEND_SCRIPT_API,
	UNPUBLISH_SCRIPT_API,
	type FriendScriptsResponse,
	type ProfileResponse,
	type SendScriptResponse
} from '../../src/lib/features/friends/friend-scripts-protocol.ts';
import { normaliseUsername, usernameKey } from '../../src/lib/features/account/account-protocol.ts';
import { readBody } from '../account/routes.ts';
import { nameStub, userStub } from '../account/objects.ts';
import { allowed, type ShareEnv } from '../share.ts';
import { describe, fail, friendBook, json, type FriendsEnv } from './routes.ts';

async function contents(env: FriendsEnv, accountId: string): Promise<FriendScriptsResponse> {
	const book = friendBook(env, accountId);
	const [inbox, published] = await Promise.all([book.inbox(), book.published()]);
	const senders = await describe(
		env,
		[...new Set(inbox.map((entry) => entry.sender))].map((id) => ({ id, at: 0 }))
	);
	const byId = new Map(senders.map((sender) => [sender.id, sender]));
	return {
		// A sender deleted since is left out, as on the Friends page.
		inbox: inbox.flatMap(({ id, sender, name, hash, at }) => {
			const from = byId.get(sender);
			return from ? [{ id, from, name, hash, at }] : [];
		}),
		published
	};
}

/** Handles `/api/friends/scripts` and below for `accountId`; undefined for any other path. */
export async function handleFriendScripts(
	request: Request,
	env: FriendsEnv,
	path: string,
	accountId: string
): Promise<Response | undefined> {
	if (path !== FRIEND_SCRIPTS_API && !path.startsWith(`${FRIEND_SCRIPTS_API}/`)) return undefined;
	const method = request.method;
	if (path === FRIEND_SCRIPTS_API && method === 'GET') return json(await contents(env, accountId));
	if (method !== 'POST') return fail(404, 'Not found');
	const body = await readBody(request);
	const mine = friendBook(env, accountId);

	if (path === SEND_SCRIPT_API) {
		if (env.FRIEND_LOOKUPS && !(await env.FRIEND_LOOKUPS.limit({ key: accountId })).success) {
			return fail(429, 'Too many tries. Wait a minute and try again.');
		}
		const script = readFriendScript(body);
		const to = body?.to;
		if (!script || typeof to !== 'string') return fail(400, 'Not a script.');
		// Both sides must hold the friendship: this one first, so an id alone reaches no one.
		const sent =
			(await mine.relationTo(to)).friend &&
			(await friendBook(env, to).receiveScript(accountId, script, Date.now()));
		return json(
			(sent ? { ok: true } : { ok: false, reason: 'not-friends' }) satisfies SendScriptResponse
		);
	}
	if (path === DISMISS_SCRIPT_API) {
		if (typeof body?.id !== 'number') return fail(400, 'Bad id.');
		await mine.dismissScript(body.id);
		return json(await contents(env, accountId));
	}
	if (path === PUBLISH_SCRIPT_API) {
		const script = readFriendScript(body);
		if (!script) return fail(400, 'Not a script.');
		if (!(await mine.publish(script, Date.now()))) {
			return fail(409, 'Your profile is full. Take a script off it first.');
		}
		return json(await contents(env, accountId));
	}
	if (path === UNPUBLISH_SCRIPT_API) {
		if (!isLastingHash(body?.hash)) return fail(400, 'Not a script.');
		await mine.unpublish(body.hash);
		return json(await contents(env, accountId));
	}
	return fail(404, 'Not found');
}

export type ProfilesEnv = FriendsEnv & Pick<ShareEnv, 'SHARE_LOOKUPS' | 'SHARE_LIMITS'>;

/**
 * `GET /api/profiles/<username>`: the account's username, icon and published scripts. No
 * sign-in needed (Trevor, 2026-10-30: "instead of having to login ... point at their
 * profile"). Lookups are limited per address, as share codes are, so names can't be tried
 * one after another. Undefined for any other path.
 */
export async function handleProfiles(
	request: Request,
	env: ProfilesEnv,
	url: URL
): Promise<Response | undefined> {
	const typed = parseProfilePath(url.pathname);
	if (typed === undefined) return undefined;
	if (request.method !== 'GET') return fail(405, 'Method not allowed');
	// Rate limits key on the caller's address; it is not stored or logged by us.
	const caller = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	if (!(await allowed(env, env.SHARE_LOOKUPS, caller))) {
		return fail(429, 'Too many tries. Wait a minute and try again.');
	}
	const notFound = fail(404, 'No one can be found with that username.');
	const username = normaliseUsername(typed);
	if (!username) return notFound;
	const holder = await nameStub(env, usernameKey(username)).holder();
	if (!holder) return notFound;
	// Published means public (Trevor, 2026-10-30): "Let people find me by username" only
	// covers friend requests, never the profile.
	const book = friendBook(env, holder);
	const user = await userStub(env, holder).profile();
	if (!user?.username) return notFound;
	const games = await book.gamesPlayed().catch(() => undefined);
	return json({
		username: user.username,
		icon: user.icon,
		scripts: await book.published(),
		...(games === undefined ? {} : { games })
	} satisfies ProfileResponse);
}
