/**
 * A script's public rating as the server keeps it (worker/script-ratings.ts), fetched once per
 * script while the app is open. Offline or not yet fetched, there is none.
 */
import { parseScriptRating, scriptRatingId, type ScriptRating } from '#lib/core/feedback/index.ts';
import { fetchJson } from '#lib/ui/fetch.ts';

// Not state: a cache of requests, which nothing on screen reads.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const fetched = new Map<string, Promise<ScriptRating | undefined>>();

export function loadScriptRating(
	name: string,
	author: string | undefined
): Promise<ScriptRating | undefined> {
	const key = `${name}\n${author ?? ''}`;
	let pending = fetched.get(key);
	if (!pending) {
		pending = scriptRatingId(name, author)
			.then((id) => fetchJson(`/api/script-rating/${id}`))
			.then(({ response, body }) => (response.ok ? parseScriptRating(body) : undefined))
			.catch(() => {
				fetched.delete(key);
				return undefined;
			});
		fetched.set(key, pending);
	}
	return pending;
}
