/**
 * A script's public rating as the server keeps it (worker/script-ratings.ts), fetched once per
 * script while the app is open. Offline or not yet fetched, there is none.
 */
import { parseScriptRating, scriptRatingId, type ScriptRating } from '#lib/core/feedback/index.ts';

const fetched = new Map<string, Promise<ScriptRating | undefined>>();

export function loadScriptRating(
	name: string,
	author: string | undefined
): Promise<ScriptRating | undefined> {
	const key = `${name}\n${author ?? ''}`;
	let pending = fetched.get(key);
	if (!pending) {
		pending = scriptRatingId(name, author)
			.then((id) => fetch(`/api/script-rating/${id}`))
			.then((response) => (response.ok ? response.json() : undefined))
			.then((json: unknown) => parseScriptRating(json))
			.catch(() => {
				fetched.delete(key);
				return undefined;
			});
		fetched.set(key, pending);
	}
	return pending;
}
