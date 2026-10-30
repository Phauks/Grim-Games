/** App links for friends' scripts and profiles (plan F9, F10). */
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

/** Where a sent or published script opens: Search loads it as a share link, into the Library. */
export function scriptOpenHref(hash: string): ResolvedPathname {
	return `${resolve('/scripts')}${hash}` as ResolvedPathname;
}

/** A profile's page, with the scripts it publishes. */
export function profileHref(username: string): ResolvedPathname {
	return resolve('/u/[username]', { username });
}
