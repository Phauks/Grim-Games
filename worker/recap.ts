import { DurableObject } from 'cloudflare:workers';
import {
	MAX_RECAP_BYTES,
	parseRecapApiPath,
	RECAP_API,
	RECAP_DELETE_KEY_HEADER,
	RECAP_TTL_MS,
	readSharedRecap,
	type CreatedRecap
} from '../src/lib/features/history/recap-share-api.ts';
import { allowed, base64url, hashKey, type ShareEnv } from './share.ts';

export interface RecapEnv extends ShareEnv {
	RECAPS: DurableObjectNamespace<SharedRecap>;
}

interface Stored {
	json: string;
	deleteKeyHash: string;
}

/**
 * One shared game recap, stored under its random id (`idFromName(id)`). Like a shared
 * script (share.ts), an alarm deletes it `RECAP_TTL_MS` after it was last opened.
 */
export class SharedRecap extends DurableObject<RecapEnv> {
	async create(json: string, deleteKeyHash: string): Promise<boolean> {
		if (await this.ctx.storage.get('recap')) return false;
		await this.ctx.storage.put('recap', { json, deleteKeyHash } satisfies Stored);
		await this.ctx.storage.setAlarm(Date.now() + RECAP_TTL_MS);
		return true;
	}

	async read(): Promise<string | undefined> {
		const stored = await this.ctx.storage.get<Stored>('recap');
		if (!stored) return undefined;
		await this.ctx.storage.setAlarm(Date.now() + RECAP_TTL_MS);
		return stored.json;
	}

	async remove(deleteKeyHash: string): Promise<boolean> {
		const stored = await this.ctx.storage.get<Stored>('recap');
		if (!stored || stored.deleteKeyHash !== deleteKeyHash) return false;
		await this.ctx.storage.deleteAll();
		return true;
	}

	async alarm(): Promise<void> {
		await this.ctx.storage.deleteAll();
	}
}

const noStore = { 'Cache-Control': 'no-store' };

function text(message: string, status: number): Response {
	return new Response(message, { status, headers: noStore });
}

/** The recap as compact JSON, or an error message. */
async function readRecapBody(request: Request): Promise<string | { error: string }> {
	const raw = await request.text();
	if (new TextEncoder().encode(raw).length > MAX_RECAP_BYTES) return { error: 'Too large' };
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return { error: 'Not JSON' };
	}
	const recap = readSharedRecap(json);
	return recap ? JSON.stringify(recap) : { error: 'Not a recap' };
}

/** Handles `/api/recap` and `/api/recap/<id>`. Rate limits are the script shares'. */
export async function handleRecap(request: Request, env: RecapEnv): Promise<Response> {
	const url = new URL(request.url);
	const caller = request.headers.get('CF-Connecting-IP') ?? 'unknown';

	if (url.pathname === RECAP_API || url.pathname === `${RECAP_API}/`) {
		if (request.method !== 'POST') return text('Method not allowed', 405);
		if (!(await allowed(env, env.SHARE_CREATES, caller))) return text('Slow down', 429);
		const json = await readRecapBody(request);
		if (typeof json !== 'string') return text(json.error, 400);
		const deleteKey = base64url(crypto.getRandomValues(new Uint8Array(16)));
		const id = base64url(crypto.getRandomValues(new Uint8Array(16)));
		const stub = env.RECAPS.get(env.RECAPS.idFromName(id));
		if (!(await stub.create(json, await hashKey(deleteKey)))) return text('Try again', 503);
		return Response.json({ id, deleteKey } satisfies CreatedRecap, {
			status: 201,
			headers: noStore
		});
	}

	const id = parseRecapApiPath(url.pathname);
	if (!id) return text('Not found', 404);
	const stub = () => env.RECAPS.get(env.RECAPS.idFromName(id));

	if (request.method === 'GET') {
		if (!(await allowed(env, env.SHARE_LOOKUPS, caller))) return text('Slow down', 429);
		const json = await stub().read();
		if (json === undefined) return text('Not found', 404);
		return new Response(json, { headers: { 'Content-Type': 'application/json', ...noStore } });
	}
	if (request.method === 'DELETE') {
		const key = request.headers.get(RECAP_DELETE_KEY_HEADER);
		if (!key) return text('Not found', 404);
		return (await stub().remove(await hashKey(key)))
			? new Response(null, { status: 204, headers: noStore })
			: text('Not found', 404);
	}
	return text('Method not allowed', 405);
}
