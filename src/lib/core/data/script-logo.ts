import type { LoadedScript } from './script.ts';

/**
 * A script's logo (Trevor, 2026-10-18: shown behind the board, in Search and in the script's
 * details). The base three show TPI's edition logo, which botc-release publishes for
 * toolmakers (`resources/editions/<edition>/logo.webp`, synced into `static/data/logos/`).
 * Any other script shows the image its author linked in `_meta.logo`, loaded from there and
 * never copied. A script without either has no logo.
 */

/** URL path of the synced edition logos, as served from `static/`. */
export const LOGOS_PATH = '/data/logos';

/**
 * The editions with a synced logo: `OFFICIAL_EDITIONS`, listed here so the Worker can read
 * logos from search results without loading the script loader.
 */
export const LOGO_EDITIONS: readonly string[] = ['tb', 'bmr', 'snv'];

/** TPI's logo for an official edition; undefined for anything else. */
export function editionLogo(edition: string | undefined): string | undefined {
	return edition && LOGO_EDITIONS.includes(edition) ? `${LOGOS_PATH}/${edition}.webp` : undefined;
}

/**
 * An author's `_meta.logo`, when it is a web address we can show: https only, since an http
 * image is blocked on our https pages, and never a `data:` or `javascript:` URL.
 */
export function authorLogo(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const text = value.trim();
	if (!/^https:\/\//i.test(text)) return undefined;
	try {
		return new URL(text).href;
	} catch {
		return undefined;
	}
}

/** The logo to show for a loaded script. */
export function scriptLogo(script: Pick<LoadedScript, 'edition' | 'meta'>): string | undefined {
	return editionLogo(script.edition) ?? authorLogo(script.meta.logo);
}

/** The `_meta.logo` of script JSON as it is listed (an array with a `_meta` entry). */
export function logoInScriptJson(json: unknown): string | undefined {
	if (!Array.isArray(json)) return undefined;
	const meta: unknown = json.find(
		(item) => typeof item === 'object' && item !== null && (item as { id?: unknown }).id === '_meta'
	);
	return authorLogo((meta as { logo?: unknown } | undefined)?.logo);
}
