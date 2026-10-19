/**
 * The shared accounts Worker, `grim-games-accounts` (wrangler.accounts.jsonc). It holds
 * every account, so production and every preview of the app sign in to the same ones
 * (Trevor, 2026-10-18: "i want to share one set of accounts"). A preview's service binding
 * always reaches this Worker's production deployment
 * (developers.cloudflare.com/workers/previews/resources/).
 *
 * It has no public address: the app Worker reaches it only through the `ACCOUNTS` service
 * binding and keeps the routes, cookies and sign-in email itself (worker/account/routes.ts).
 * Each method hands back a Durable Object stub, which the app calls as it would its own.
 */
import { WorkerEntrypoint } from 'cloudflare:workers';
import {
	AccountEmail,
	AccountName,
	AccountUser,
	localAccounts,
	type AccountCall,
	type AccountEnv
} from './account/objects.ts';

export { AccountEmail, AccountName, AccountUser };

/** The methods the app may call on each kind of object: its own, not the runtime's. */
const callable = Object.fromEntries(
	(
		[
			['user', AccountUser],
			['address', AccountEmail],
			['username', AccountName]
		] as const
	).map(([kind, type]) => [
		kind,
		new Set(
			Object.getOwnPropertyNames(type.prototype).filter(
				(name) => !['constructor', 'fetch', 'alarm'].includes(name)
			)
		)
	])
) as Record<AccountCall['kind'], Set<string>>;

export default class AccountsService extends WorkerEntrypoint<AccountEnv> {
	/**
	 * Runs one method on one account object and returns its answer. A Durable Object stub
	 * can't be handed across a service binding, so each call is forwarded by name.
	 */
	async call({ kind, key, method, args }: AccountCall): Promise<unknown> {
		if (!callable[kind]?.has(method)) throw new Error(`No account method ${kind}.${method}`);
		const stub = localAccounts(this.env)[kind](key) as unknown as Record<
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
