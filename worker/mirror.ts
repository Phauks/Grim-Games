/**
 * Our own copy of the scripts other sites list (Trevor, 2026-10-17: "self host"): the
 * official site's custom scripts, the Carousel Script Collection and the Script World Cups.
 * A scheduled job refreshes every copy each night (`refreshAll`); a source whose copy is
 * over a day old (or missing, as in a new Worker Preview, which runs no schedule) is
 * refreshed when someone asks for it. A refresh that fails keeps the last good copy, so a
 * site changing or going down never empties a source. One SQLite Durable Object holds them.
 */
import { DurableObject } from 'cloudflare:workers';

export interface MirrorEnv {
	SCRIPT_MIRROR: DurableObjectNamespace<ScriptMirror>;
}

export interface Snapshot {
	/** The answer the route sends (JSON text), without `fetchedAt`. */
	body: string;
	/** When the copy was last refreshed successfully (ms). */
	fetchedAt: number;
	/** When a refresh was last tried (ms). */
	checkedAt: number;
	/** Why the last try failed; unset after a success. */
	problem?: string;
}

const DAY_MS = 86_400_000;
/** A source that failed is tried again on demand after this long. */
const RETRY_MS = 3_600_000;
const CACHE_SECONDS = 3600;

export class ScriptMirror extends DurableObject<MirrorEnv> {
	async read(source: string): Promise<Snapshot | undefined> {
		return this.ctx.storage.get<Snapshot>(source);
	}

	async write(source: string, body: string): Promise<Snapshot> {
		const now = Date.now();
		const snapshot: Snapshot = { body, fetchedAt: now, checkedAt: now };
		await this.ctx.storage.put(source, snapshot);
		return snapshot;
	}

	/** Notes a failed refresh; the last good copy stays. */
	async fail(source: string, problem: string): Promise<Snapshot | undefined> {
		const old = await this.ctx.storage.get<Snapshot>(source);
		if (!old) {
			await this.ctx.storage.put(`problem:${source}`, { problem, checkedAt: Date.now() });
			return undefined;
		}
		const snapshot: Snapshot = { ...old, checkedAt: Date.now(), problem };
		await this.ctx.storage.put(source, snapshot);
		return snapshot;
	}

	/** Each source's dates and last problem, without the scripts. */
	async status(): Promise<Record<string, Omit<Snapshot, 'body'>>> {
		const out: Record<string, Omit<Snapshot, 'body'>> = {};
		for (const [key, value] of await this.ctx.storage.list<Snapshot>()) {
			if (key.startsWith('problem:')) {
				const source = key.slice('problem:'.length);
				const failed = value as unknown as { problem: string; checkedAt: number };
				out[source] ??= { fetchedAt: 0, checkedAt: failed.checkedAt, problem: failed.problem };
			} else {
				const { fetchedAt, checkedAt, problem } = value;
				out[key] = { fetchedAt, checkedAt, ...(problem ? { problem } : {}) };
			}
		}
		return out;
	}
}

/**
 * One source: `build` fetches it from its site and returns the route's answer, or throws
 * (with a reason) when the site gave nothing usable. `previous` is the last good answer.
 */
export interface MirroredSource {
	id: string;
	build(previous: Record<string, unknown> | undefined): Promise<Record<string, unknown>>;
}

function mirror(env: MirrorEnv) {
	return env.SCRIPT_MIRROR.get(env.SCRIPT_MIRROR.idFromName('scripts'));
}

async function refresh(
	env: MirrorEnv,
	source: MirroredSource,
	old: Snapshot | undefined
): Promise<{ snapshot?: Snapshot; problem?: string }> {
	const stub = mirror(env);
	try {
		const previous = old ? (JSON.parse(old.body) as Record<string, unknown>) : undefined;
		return { snapshot: await stub.write(source.id, JSON.stringify(await source.build(previous))) };
	} catch (error) {
		const problem = error instanceof Error ? error.message : String(error);
		console.warn('mirror', source.id, problem);
		return { snapshot: await stub.fail(source.id, problem), problem };
	}
}

/** The route's answer from our copy, refreshing it first when it is due. */
export async function serveMirrored(env: MirrorEnv, source: MirroredSource): Promise<Response> {
	const old = await mirror(env).read(source.id);
	const now = Date.now();
	const due =
		!old ||
		now - old.checkedAt > (old.problem ? RETRY_MS : DAY_MS) ||
		now - old.fetchedAt > DAY_MS * 2;
	const { snapshot, problem } = due ? await refresh(env, source, old) : { snapshot: old };
	if (!snapshot) {
		// Never cached: nothing to show yet, and the next ask should try again.
		return Response.json(
			{ error: problem ?? 'Nothing stored yet.' },
			{ status: 502, headers: { 'Cache-Control': 'no-store' } }
		);
	}
	return Response.json(
		{
			...(JSON.parse(snapshot.body) as Record<string, unknown>),
			fetchedAt: new Date(snapshot.fetchedAt).toISOString()
		},
		{ headers: { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } }
	);
}

/** The nightly job: every source refreshed, one after another. */
export async function refreshAll(
	env: MirrorEnv,
	sources: readonly MirroredSource[]
): Promise<void> {
	for (const source of sources) {
		await refresh(env, source, await mirror(env).read(source.id));
	}
}

/** `/api/mirror`: when each copy was refreshed and why the last try failed, for diagnosis. */
export async function mirrorStatus(env: MirrorEnv): Promise<Response> {
	return Response.json(await mirror(env).status(), { headers: { 'Cache-Control': 'no-store' } });
}
