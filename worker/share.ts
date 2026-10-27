import { noStore, text } from './http.ts';
import { DurableObject } from 'cloudflare:workers';
import { makeDigitCode } from '../src/lib/core/codes/digit-code.ts';
import {
	DELETE_KEY_HEADER,
	MAX_SHARED_BYTES,
	parseShareCodePath,
	SHARE_API,
	SHARE_CODE_DIGITS,
	SHARE_TTL_MS,
	type CreatedShare
} from '../src/lib/features/scripts/share-codes-api.ts';
import { remote, type DataBinding } from './shared-data.ts';

export interface ShareEnv {
	SHARED_SCRIPTS: DurableObjectNamespace<SharedScript>;
	/** Shared with production and every preview when bound (worker/shared-data.ts). */
	DATA?: DataBinding;
	/** Per-address limits, so codes can't be found by trying many (wrangler.jsonc). */
	SHARE_LOOKUPS: RateLimit;
	SHARE_CREATES: RateLimit;
	/**
	 * "off" only in the local e2e server (playwright.config.ts), where every test shares one
	 * address and a full run would trip the limits. Never set on Cloudflare.
	 */
	SHARE_LIMITS?: string;
}

/** The most entries a stored script may have (the largest official one has about 30). */
const MAX_ENTRIES = 400;
/** A taken code is drawn again; with a million codes, five tries is plenty. */
const CREATE_ATTEMPTS = 5;

interface Stored {
	json: string;
	deleteKeyHash: string;
}

/**
 * One shared script, stored under its code (`idFromName(code)`). An alarm deletes it
 * `SHARE_TTL_MS` after it was last opened; Durable Object storage otherwise lasts until
 * deleted (developers.cloudflare.com/durable-objects/api/alarms/).
 */
export class SharedScript extends DurableObject<ShareEnv> {
	/** Stores the script unless this code is already taken. */
	async create(json: string, deleteKeyHash: string): Promise<boolean> {
		if (await this.ctx.storage.get('script')) return false;
		await this.ctx.storage.put('script', { json, deleteKeyHash } satisfies Stored);
		await this.ctx.storage.setAlarm(Date.now() + SHARE_TTL_MS);
		return true;
	}

	/** The script JSON, pushing its expiry back; undefined if there is none. */
	async read(): Promise<string | undefined> {
		const stored = await this.ctx.storage.get<Stored>('script');
		if (!stored) return undefined;
		await this.ctx.storage.setAlarm(Date.now() + SHARE_TTL_MS);
		return stored.json;
	}

	/** Deletes the script if `deleteKeyHash` matches. */
	async remove(deleteKeyHash: string): Promise<boolean> {
		const stored = await this.ctx.storage.get<Stored>('script');
		if (!stored || stored.deleteKeyHash !== deleteKeyHash) return false;
		await this.ctx.storage.deleteAll();
		return true;
	}

	async alarm(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}

export function base64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

export async function hashKey(key: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
	return base64url(new Uint8Array(digest));
}

/** The script JSON as compact text, or an error message. Only shape is checked here. */
async function readScriptBody(request: Request): Promise<string | { error: string }> {
	const raw = await request.text();
	if (new TextEncoder().encode(raw).length > MAX_SHARED_BYTES) return { error: 'Too large' };
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return { error: 'Not JSON' };
	}
	if (!Array.isArray(json) || json.length === 0 || json.length > MAX_ENTRIES) {
		return { error: 'Not a script' };
	}
	return JSON.stringify(json);
}

export async function allowed(env: ShareEnv, limiter: RateLimit, caller: string): Promise<boolean> {
	if (env.SHARE_LIMITS === 'off') return true;
	return (await limiter.limit({ key: caller })).success;
}

/** Handles `/api/share` and `/api/share/<code>`. */
/** The shared script stored under `code`: the shared data Worker's when bound, else this one's. */
function shareStub(env: ShareEnv, code: string): DurableObjectStub<SharedScript> {
	return env.DATA ? remote(env.DATA, 'share', code) : localShare(env, code);
}

export const localShare = (env: Pick<ShareEnv, 'SHARED_SCRIPTS'>, code: string) =>
	env.SHARED_SCRIPTS.get(env.SHARED_SCRIPTS.idFromName(code));

export async function handleShare(request: Request, env: ShareEnv): Promise<Response> {
	const url = new URL(request.url);
	// Rate limits key on the caller's address; it is not stored or logged by us.
	const caller = request.headers.get('CF-Connecting-IP') ?? 'unknown';

	if (url.pathname === SHARE_API || url.pathname === `${SHARE_API}/`) {
		if (request.method !== 'POST') return text('Method not allowed', 405);
		if (!(await allowed(env, env.SHARE_CREATES, caller))) return text('Slow down', 429);
		const json = await readScriptBody(request);
		if (typeof json !== 'string') return text(json.error, 400);
		const deleteKey = base64url(crypto.getRandomValues(new Uint8Array(16)));
		const deleteKeyHash = await hashKey(deleteKey);
		for (let i = 0; i < CREATE_ATTEMPTS; i++) {
			const code = makeDigitCode(SHARE_CODE_DIGITS);
			const stub = shareStub(env, code);
			if (await stub.create(json, deleteKeyHash)) {
				return Response.json({ code, deleteKey } satisfies CreatedShare, {
					status: 201,
					headers: noStore
				});
			}
		}
		return text('No free code', 503);
	}

	const code = parseShareCodePath(url.pathname);
	if (!code) return text('Not found', 404);
	const stub = () => shareStub(env, code);

	if (request.method === 'GET') {
		if (!(await allowed(env, env.SHARE_LOOKUPS, caller))) return text('Slow down', 429);
		const json = await stub().read();
		if (json === undefined) return text('Not found', 404);
		return new Response(`{"json":${json}}`, {
			headers: { 'Content-Type': 'application/json', ...noStore }
		});
	}
	if (request.method === 'DELETE') {
		const key = request.headers.get(DELETE_KEY_HEADER);
		if (!key) return text('Not found', 404);
		return (await stub().remove(await hashKey(key)))
			? new Response(null, { status: 204, headers: noStore })
			: text('Not found', 404);
	}
	return text('Method not allowed', 405);
}
