/**
 * `/api/auth/*` (sign in and out) and `/api/account/*` (the signed-in user's profile).
 *
 * Sessions are an HttpOnly cookie scoped to `/api`, so page scripts never see the token.
 * Every request that changes something must come from our own pages (`Origin` check) with a
 * JSON body, which together stop other sites from sending them with the user's cookie.
 * Nothing private is read from the URL: codes, tokens and documents travel in bodies.
 */
import {
	describeDevice,
	isDocId,
	isDocKind,
	normaliseCode,
	normaliseEmail,
	normaliseUsername,
	SESSION_COOKIE,
	SESSION_IDLE_MS,
	signInHash,
	type ApiError,
	type PutDocRequest,
	type SessionInfo,
	type StartResponse,
	type UserResponse,
	usernameKey,
	USERNAME_MAX,
	USERNAME_MIN
} from '../../src/lib/features/account/account-protocol.ts';
import {
	changeEmailCode,
	emailChangedNotice,
	emailSender,
	signInEmail,
	type EmailEnv
} from './email.ts';
import { isLegacyAccountId, isWordAccountId } from '../../src/lib/features/account/account-id.ts';
import {
	userStub,
	type AccountEnv,
	type AccountUser,
	type Authenticated,
	type ChangeResult,
	type PutResult
} from './objects.ts';

export type Env = AccountEnv & EmailEnv & { AUTH_STARTS?: RateLimit };

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', ...headers }
	});
}

function fail(status: number, error: string): Response {
	return json({ error } satisfies ApiError, status);
}

function sessionCookie(value: string, maxAgeSeconds: number): string {
	return `${SESSION_COOKIE}=${value}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

const clearCookie = sessionCookie('', 0);

function readCookie(request: Request): string | undefined {
	for (const part of (request.headers.get('Cookie') ?? '').split(';')) {
		const [name, ...rest] = part.trim().split('=');
		if (name === SESSION_COOKIE) return rest.join('=');
	}
	return undefined;
}

/** The signed-in user for this request, if any. The `getUser(request)` port from 07 §7. */
export async function getUser(
	request: Request,
	env: AccountEnv
): Promise<(Authenticated & { userId: string }) | undefined> {
	const cookie = readCookie(request);
	// `<account id>.<secret>`; ids have no dots.
	const match = cookie && /^([a-z0-9-]{1,80})\.([\w-]{20,100})$/.exec(cookie);
	if (!match || !(isWordAccountId(match[1]) || isLegacyAccountId(match[1]))) return undefined;
	let stub: DurableObjectStub<AccountUser>;
	try {
		stub = userStub(env, match[1]);
	} catch {
		return undefined;
	}
	const found = await stub.authenticate(match[2], Date.now());
	return found && { ...found, userId: match[1] };
}

/** Changes must come from our own pages, with a JSON body. */
function sameOriginJson(request: Request, url: URL): boolean {
	if (request.headers.get('Origin') !== url.origin) return false;
	return (request.headers.get('Content-Type') ?? '').startsWith('application/json');
}

async function readBody(request: Request): Promise<Record<string, unknown> | undefined> {
	const text = await request.text();
	if (text.length > 1_100_000) return undefined;
	try {
		const body: unknown = JSON.parse(text || '{}');
		return typeof body === 'object' && body !== null && !Array.isArray(body)
			? (body as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

async function start(request: Request, env: Env, url: URL): Promise<Response> {
	const sender = emailSender(env, url);
	if (sender.delivery === 'unavailable') {
		return fail(503, 'Signing in is not available yet on this site.');
	}
	// Per network address, on top of the per-email limit in AccountEmail.
	const caller = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	if (env.AUTH_STARTS && !(await env.AUTH_STARTS.limit({ key: caller })).success) {
		return fail(429, 'Too many sign-in attempts. Wait a minute and try again.');
	}
	const email = normaliseEmail((await readBody(request))?.email);
	if (!email) return fail(400, 'Enter a valid email address.');
	const result = await env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(email)).start(
		Date.now()
	);
	if (!result.ok) {
		return fail(429, 'Too many codes for this address. Wait an hour and try again.');
	}
	const link = `${url.origin}/account${signInHash(email, result.token)}`;
	try {
		await sender.send(signInEmail(email, result.code, link));
	} catch (e) {
		console.error('Sign-in email failed', e);
		return fail(502, 'The sign-in email could not be sent. Try again later.');
	}
	const response: StartResponse =
		sender.delivery === 'preview'
			? { delivery: 'preview', preview: { code: result.code, link } }
			: { delivery: sender.delivery };
	return json(response);
}

async function verify(request: Request, env: Env, url: URL): Promise<Response> {
	if (emailSender(env, url).delivery === 'unavailable') {
		return fail(503, 'Signing in is not available yet on this site.');
	}
	const body = await readBody(request);
	const email = normaliseEmail(body?.email);
	const code = normaliseCode(body?.code);
	const token =
		typeof body?.token === 'string' && /^[\w-]{20,100}$/.test(body.token) ? body.token : undefined;
	if (!email || (!code && !token)) return fail(400, 'Enter the code from the email.');
	const now = Date.now();
	const result = await env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(email)).verify(
		email,
		code ? { code } : { token: token! },
		now
	);
	if (!result.ok) {
		const message = {
			expired: 'This code has expired. Send a new one.',
			wrong: 'That code is not right. Check the email and try again.',
			'too-many': 'Too many wrong codes. Send a new one.'
		}[result.reason];
		return fail(result.reason === 'wrong' ? 401 : 410, message);
	}
	const user = userStub(env, result.userId);
	const cookie = await user.createSession(describeDevice(request.headers.get('User-Agent')), now);
	const signedIn = await user.authenticate(cookie.split('.')[1], now);
	return json(
		{
			user: signedIn?.user ?? null,
			delivery: emailSender(env, url).delivery
		} satisfies SessionInfo,
		200,
		{ 'Set-Cookie': sessionCookie(cookie, Math.floor(SESSION_IDLE_MS / 1000)) }
	);
}

/** `POST /api/account/email/start`: sends a code to the new address. */
async function startEmailChange(
	request: Request,
	env: Env,
	url: URL,
	auth: Authenticated & { userId: string }
): Promise<Response> {
	const sender = emailSender(env, url);
	if (sender.delivery === 'unavailable') {
		return fail(503, 'Email is not available yet on this site.');
	}
	const caller = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	if (env.AUTH_STARTS && !(await env.AUTH_STARTS.limit({ key: caller })).success) {
		return fail(429, 'Too many codes asked for. Wait a minute and try again.');
	}
	const email = normaliseEmail((await readBody(request))?.email);
	if (!email) return fail(400, 'Enter a valid email address.');
	if (email === auth.user.email) return fail(400, 'That is already your email address.');
	const result = await env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(email)).startChange(
		auth.userId,
		Date.now()
	);
	if (!result.ok) {
		return fail(429, 'Too many codes for this address. Wait an hour and try again.');
	}
	try {
		await sender.send(changeEmailCode(email, result.code));
	} catch (e) {
		console.error('Change-email code failed', e);
		return fail(502, 'The email could not be sent. Try again later.');
	}
	const response: StartResponse =
		sender.delivery === 'preview'
			? { delivery: 'preview', preview: { code: result.code, link: '' } }
			: { delivery: sender.delivery };
	return json(response);
}

/**
 * `POST /api/account/email/verify`: the new address now points at this account, the
 * account's email is the new one, the old address is released and told.
 */
async function verifyEmailChange(
	request: Request,
	env: Env,
	url: URL,
	auth: Authenticated & { userId: string }
): Promise<Response> {
	const body = await readBody(request);
	const email = normaliseEmail(body?.email);
	const code = normaliseCode(body?.code);
	if (!email || !code) return fail(400, 'Enter the code from the email.');
	const result = (await env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(email)).confirmChange(
		auth.userId,
		code,
		Date.now()
	)) as ChangeResult;
	if (!result.ok) {
		const message = {
			expired: 'This code has expired. Send a new one.',
			wrong: 'That code is not right. Check the email and try again.',
			'too-many': 'Too many wrong codes. Send a new one.',
			taken: 'That address already has an account. Delete that account first to use it here.'
		}[result.reason];
		return fail(result.reason === 'wrong' ? 401 : result.reason === 'taken' ? 409 : 410, message);
	}
	const user = userStub(env, auth.userId);
	const changed = await user.setEmail(email);
	if (changed.old && changed.old !== email) {
		await env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(changed.old)).forget(auth.userId);
		try {
			await emailSender(env, url).send(emailChangedNotice(changed.old, email));
		} catch (e) {
			// The change is done; a lost notice shouldn't undo or fail it.
			console.error('Email-changed notice failed', e);
		}
	}
	return json({ user: changed.user! } satisfies UserResponse);
}

/** `PUT /api/account/username`: claims the new name, then frees the old one. */
async function setUsername(
	request: Request,
	env: Env,
	auth: Authenticated & { userId: string }
): Promise<Response> {
	const name = normaliseUsername((await readBody(request))?.username);
	if (!name) {
		return fail(
			400,
			`A username is ${USERNAME_MIN} to ${USERNAME_MAX} letters A-Z, digits, dots, dashes or underscores.`
		);
	}
	const key = usernameKey(name);
	const oldKey = auth.user.username === null ? undefined : usernameKey(auth.user.username);
	if (key !== oldKey) {
		const claimed = await env.ACCOUNT_NAMES.get(env.ACCOUNT_NAMES.idFromName(key)).claim(
			auth.userId
		);
		if (!claimed) return fail(409, 'That username is taken.');
	}
	const user = userStub(env, auth.userId);
	const changed = await user.setUsername(name);
	if (oldKey !== undefined && oldKey !== key) {
		await env.ACCOUNT_NAMES.get(env.ACCOUNT_NAMES.idFromName(oldKey)).release(auth.userId);
	}
	return json({ user: changed.user! } satisfies UserResponse);
}

/** Handles `/api/auth/*` and `/api/account/*`. Undefined for any other path. */
export async function handleAccount(
	request: Request,
	env: Env,
	url: URL
): Promise<Response | undefined> {
	const path = url.pathname;
	if (!path.startsWith('/api/auth/') && !path.startsWith('/api/account')) return undefined;
	const method = request.method;
	if (method !== 'GET' && !sameOriginJson(request, url)) {
		return fail(403, 'This request must come from the app.');
	}

	if (path === '/api/auth/start' && method === 'POST') return start(request, env, url);
	if (path === '/api/auth/verify' && method === 'POST') return verify(request, env, url);

	const auth = await getUser(request, env);
	if (path === '/api/auth/session' && method === 'GET') {
		return json(
			{ user: auth?.user ?? null, delivery: emailSender(env, url).delivery } satisfies SessionInfo,
			200,
			// A live session's cookie is renewed, so it ends after 180 days unused (not 180 days
			// after signing in), matching the server; a cookie for an ended session is removed.
			auth
				? { 'Set-Cookie': sessionCookie(readCookie(request)!, Math.floor(SESSION_IDLE_MS / 1000)) }
				: readCookie(request)
					? { 'Set-Cookie': clearCookie }
					: {}
		);
	}
	if (path === '/api/auth/sign-out' && method === 'POST') {
		if (auth) {
			await userStub(env, auth.userId).endSession(auth.sessionId);
		}
		return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
	}

	if (!auth) return fail(401, 'Sign in first.');
	const user = userStub(env, auth.userId);

	if (path === '/api/account/email/start' && method === 'POST') {
		return startEmailChange(request, env, url, auth);
	}
	if (path === '/api/account/email/verify' && method === 'POST') {
		return verifyEmailChange(request, env, url, auth);
	}
	if (path === '/api/account/username' && method === 'PUT') return setUsername(request, env, auth);
	if (path === '/api/account/sessions' && method === 'GET') {
		return json({ sessions: await user.sessions(auth.sessionId) });
	}
	const session = /^\/api\/account\/sessions\/([\w-]{1,32})$/.exec(path);
	if (session && method === 'DELETE') {
		await user.endSession(session[1]);
		return json({ ok: true });
	}
	if (path === '/api/account/sessions/others' && method === 'POST') {
		await user.endOtherSessions(auth.sessionId);
		return json({ ok: true });
	}
	if (path === '/api/account/export' && method === 'GET') {
		return json(await user.exportAll(), 200, {
			'Content-Disposition': 'attachment; filename="grim-games-account.json"'
		});
	}
	if (path === '/api/account' && method === 'DELETE') {
		const { email, username } = await user.deleteAccount();
		if (email) {
			await env.ACCOUNT_EMAILS.get(env.ACCOUNT_EMAILS.idFromName(email)).forget(auth.userId);
		}
		if (username) {
			await env.ACCOUNT_NAMES.get(env.ACCOUNT_NAMES.idFromName(usernameKey(username))).release(
				auth.userId
			);
		}
		return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });
	}

	const docs = /^\/api\/account\/docs\/([a-z]+)(?:\/([^/]+))?$/.exec(path);
	if (docs) {
		const [, kind, id] = docs;
		if (!isDocKind(kind)) return fail(404, 'Not found');
		if (!id && method === 'GET') return json({ docs: await user.listDocs(kind) });
		if (id && method === 'PUT') {
			if (!isDocId(id)) return fail(400, 'Bad document id.');
			const body = (await readBody(request)) as Partial<PutDocRequest> | undefined;
			const baseRev = body?.baseRev;
			if (!body || typeof baseRev !== 'number' || !Number.isInteger(baseRev) || baseRev < 0) {
				return fail(400, 'Bad document.');
			}
			const deleted = body.deleted === true;
			if (!deleted && body.body === undefined) return fail(400, 'Bad document.');
			// Workers RPC typing can't express `unknown` bodies, so the union is restated here.
			const result = (await user.putDoc(
				kind,
				id,
				baseRev,
				body.body,
				deleted,
				Date.now()
			)) as unknown as PutResult;
			if (result.ok) return json(result.doc);
			if (result.reason === 'conflict') return json(result.doc, 409);
			return fail(
				413,
				result.reason === 'too-large' ? 'This is too large to save.' : 'Your profile is full.'
			);
		}
	}
	return fail(404, 'Not found');
}
