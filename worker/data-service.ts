/**
 * The shared data Worker, `grim-games-data` (wrangler.data.jsonc): accounts and script share
 * codes for production and every preview of the app (worker/shared-data.ts). Live rooms and
 * the script mirror stay in each build: a room only lasts one game and its protocol can
 * differ between builds, and the mirror is a cache.
 *
 * It has no public address: the app Worker reaches it only through the `DATA` service
 * binding and keeps the routes, cookies, rate limits and sign-in email itself.
 */
import { WorkerEntrypoint } from 'cloudflare:workers';
import {
	AccountEmail,
	AccountName,
	AccountUser,
	localAccounts,
	type AccountEnv
} from './account/objects.ts';
import { localShare, SharedScript, type ShareEnv } from './share.ts';
import type { DataCall, DataKind } from './shared-data.ts';

export { AccountEmail, AccountName, AccountUser, SharedScript };

type DataEnv = Omit<AccountEnv, 'DATA'> & Pick<ShareEnv, 'SHARED_SCRIPTS'>;

/** Each kind's class, and its object by key. */
const kinds: Record<DataKind, [{ prototype: object }, (env: DataEnv, key: string) => unknown]> = {
	user: [AccountUser, (env, key) => localAccounts(env).user(key)],
	address: [AccountEmail, (env, key) => localAccounts(env).address(key)],
	username: [AccountName, (env, key) => localAccounts(env).username(key)],
	share: [SharedScript, localShare]
};

/** The methods the app may call on each kind of object: its own, not the runtime's. */
const callable = Object.fromEntries(
	Object.entries(kinds).map(([kind, [type]]) => [
		kind,
		new Set(
			Object.getOwnPropertyNames(type.prototype).filter(
				(name) => !['constructor', 'fetch', 'alarm'].includes(name)
			)
		)
	])
) as Record<DataKind, Set<string>>;

export default class DataService extends WorkerEntrypoint<DataEnv> {
	/** Runs one method on one shared object and returns its answer. */
	async call({ kind, key, method, args }: DataCall): Promise<unknown> {
		if (!callable[kind]?.has(method)) throw new Error(`No shared method ${kind}.${method}`);
		const stub = kinds[kind][1](this.env, key) as Record<
			string,
			(...args: unknown[]) => Promise<unknown>
		>;
		return stub[method](...args);
	}

	/** Nothing is served over HTTP. */
	override fetch(): Response {
		return new Response('Not found', { status: 404 });
	}
}
