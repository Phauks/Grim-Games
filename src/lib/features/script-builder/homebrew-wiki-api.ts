/**
 * The BotC Homebrew Wiki (https://botchomebrew.wiki, Trevor 2026-10-17: "full of customs")
 * as a character source for the Script builder. Shared by the Worker, which fetches the site
 * (it sends no CORS headers), and the page, which reads our answer.
 *
 * Only three of the site's public read endpoints are used, each on a tap:
 * - `/collections.json`: the collections (id and display name);
 * - `/api/page-json?type=collection&slug=<id>`: a collection in TPI's script format, with
 *   each homebrew character's full definition and jinxes (the site's Download JSON button);
 * - `/characters.json?fields=grid`: each character's creator and wiki page, for credits.
 * Nothing is mirrored or bundled; answers are cached briefly by the Worker.
 */

export const HOMEBREW_WIKI_ORIGIN = 'https://botchomebrew.wiki';

export interface HomebrewCollection {
	id: string;
	name: string;
}

export interface HomebrewCredit {
	/** The character's name as the wiki writes it. */
	name: string;
	creator: string;
	/** Its page on the wiki. */
	url: string;
}

/** Our answer for one collection. */
export interface HomebrewCollectionAnswer {
	/** TPI's script format: `_meta`, then characters (homebrew ones as objects). */
	script: unknown[];
	credits: HomebrewCredit[];
}

/** Collection ids are kebab case on the site; anything else is never sent upstream. */
export const COLLECTION_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** The collections in `/collections.json`, A–Z by name. */
export function readCollections(json: unknown): HomebrewCollection[] {
	if (!Array.isArray(json)) return [];
	const out = json.flatMap((row): HomebrewCollection[] => {
		if (!isObject(row)) return [];
		const id = text(row.id);
		const name = text(row.displayName) || text(row.slug) || id;
		return COLLECTION_ID.test(id) ? [{ id, name }] : [];
	});
	return out.sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Names compared loosely: case, accents and punctuation aside. */
export function creditKey(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/**
 * Credits for the homebrew characters on a collection's script, from the grid feed. Names are
 * not unique on the wiki: a second Glassblower gets the page `c/call-of-the-executioner/
 * glassblower-2` (Trevor, 2026-10-23). So a character in the collection itself, whose page is
 * under `c/<collection>/`, is matched first; a name the collection has no row for falls back
 * to the first character of that name elsewhere.
 */
export function readCredits(
	grid: unknown,
	script: readonly unknown[],
	collection?: string
): HomebrewCredit[] {
	const wanted = new Set(
		script.flatMap((entry) =>
			isObject(entry) && entry.id !== '_meta' && text(entry.name)
				? [creditKey(text(entry.name))]
				: []
		)
	);
	if (!Array.isArray(grid)) return [];
	const rows = grid.flatMap((row) => {
		if (!isObject(row)) return [];
		const name = text(row.name);
		const page = text(row.page).replace(/^\/+/, '');
		return wanted.has(creditKey(name)) && page ? [{ name, creator: text(row.creator), page }] : [];
	});
	const own = collection ? `c/${collection}/` : undefined;
	const ordered = own
		? [
				...rows.filter((r) => r.page.startsWith(own)),
				...rows.filter((r) => !r.page.startsWith(own))
			]
		: rows;
	const seen = new Set<string>();
	return ordered.flatMap(({ name, creator, page }): HomebrewCredit[] => {
		const key = creditKey(name);
		if (seen.has(key)) return [];
		seen.add(key);
		return [{ name, creator, url: `${HOMEBREW_WIKI_ORIGIN}/${page}` }];
	});
}
