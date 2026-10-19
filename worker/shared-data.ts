/**
 * Data that production and every preview share (Trevor, 2026-10-19: "I would prefer it all
 * uses the same. Don't mind mixing prod with beta"). Previews get their own empty Durable
 * Objects, so the shared ones live in a second Worker, `grim-games-data`
 * (worker/data-service.ts), reached through the `DATA` service binding. A preview's binding
 * always reaches that Worker's production deployment
 * (developers.cloudflare.com/workers/previews/resources/).
 *
 * Without the binding, this Worker's own objects are used, as before.
 */

/** The kinds of shared object, by what each is found by. */
export type DataKind = 'user' | 'address' | 'username' | 'share' | 'reports';

/** One method call on one shared object. */
export interface DataCall {
	kind: DataKind;
	key: string;
	method: string;
	args: unknown[];
}

/** What the shared data Worker offers over its service binding. */
export interface DataBinding {
	call(request: DataCall): Promise<unknown>;
}

/**
 * Stands in for a stub of the shared data Worker's object. A Durable Object stub can't be
 * handed across a service binding, so each method call goes over it by name, with plain data
 * in and out, as calls to a stub do.
 */
export function remote<T>(binding: DataBinding, kind: DataKind, key: string): T {
	return new Proxy(
		{},
		{
			get: (_target, method) =>
				typeof method === 'string' && method !== 'then'
					? (...args: unknown[]) => binding.call({ kind, key, method, args })
					: undefined
		}
	) as T;
}
