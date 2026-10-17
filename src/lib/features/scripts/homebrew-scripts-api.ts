/**
 * The BOTC HomeBrew Wiki's published scripts (https://botchomebrew.wiki/scripts) as a Search
 * source (Trevor, 2026-10-17). Shared by the Worker, which fetches the site (it sends no CORS
 * headers), and the page, which reads our answer.
 *
 * Two of the site's public read endpoints are used, on demand and cached by the Worker
 * (its robots.txt asks crawlers to keep out of /api/, so nothing is crawled or mirrored):
 * - `/scripts.json?fields=browse`, with `/characters.json?fields=grid` for each character's
 *   name and type: the list;
 * - `/api/page-json?type=script&slug=<slug>`: one script in TPI's format (the site's
 *   Download JSON button), loaded when a script is opened.
 * The site has no licence: every script credits its author and links to its own wiki page.
 */
import type { BotcScriptsEntry } from './botcscripts-api.ts';

export const HOMEBREW_ORIGIN = 'https://botchomebrew.wiki';
/** Our Worker's routes for the list and for one script (`worker/homebrew-scripts.ts`). */
export const HOMEBREW_SCRIPTS_API = '/api/homebrew-scripts';

/** Script slugs as the site allows them; anything else is never sent upstream. */
export const HOMEBREW_SLUG = /^[a-z0-9-]{1,80}$/;

/** One listed script: enough for a row and the character badges. */
export interface HomebrewScript {
	slug: string;
	name: string;
	author: string;
	/** Official characters by id; homebrew ones with their own name and team. */
	characters: BotcScriptsEntry[];
}

export function homebrewScriptPage(slug: string): string {
	return `${HOMEBREW_ORIGIN}/s/${slug}`;
}

export function homebrewScriptPath(slug: string): string {
	return `${HOMEBREW_SCRIPTS_API}/${slug}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/** Official characters are listed with an `off-` prefix on the wiki. */
const OFFICIAL_PREFIX = 'off-';

/**
 * The list from `/scripts.json?fields=browse`, each character named and typed from the
 * `/characters.json?fields=grid` feed. Scripts with a bad slug or no name are left out.
 */
export function readHomebrewScripts(list: unknown, grid: unknown): HomebrewScript[] {
	if (!Array.isArray(list)) return [];
	const bySlug = new Map<string, { name: string; team: string }>();
	if (Array.isArray(grid)) {
		for (const row of grid) {
			if (!isObject(row)) continue;
			const slug = text(row.slug);
			if (slug) bySlug.set(slug, { name: text(row.name), team: text(row.team) });
		}
	}
	return list.flatMap((row): HomebrewScript[] => {
		if (!isObject(row)) return [];
		const slug = text(row.slug);
		const name = text(row.name);
		if (!HOMEBREW_SLUG.test(slug) || !name) return [];
		const characters = (Array.isArray(row.characters) ? row.characters : []).flatMap(
			(id): BotcScriptsEntry[] => {
				const character = text(id);
				if (!character) return [];
				if (character.startsWith(OFFICIAL_PREFIX)) {
					return [{ id: character.slice(OFFICIAL_PREFIX.length) }];
				}
				const known = bySlug.get(character);
				// Not in the grid: an official character listed by its own id.
				return [known ? { id: character, name: known.name, team: known.team } : { id: character }];
			}
		);
		return [{ slug, name, author: text(row.author), characters }];
	});
}

/** Our list answer as the page reads it back (also its copy kept on the device). */
export function readHomebrewList(json: unknown): HomebrewScript[] | undefined {
	if (!isObject(json) || !Array.isArray(json.scripts)) return undefined;
	return json.scripts.flatMap((row): HomebrewScript[] => {
		if (!isObject(row)) return [];
		const slug = text(row.slug);
		const name = text(row.name);
		if (!HOMEBREW_SLUG.test(slug) || !name || !Array.isArray(row.characters)) return [];
		const characters = row.characters.flatMap((c): BotcScriptsEntry[] =>
			isObject(c) && text(c.id)
				? [
						{
							id: text(c.id),
							...(text(c.name) ? { name: text(c.name) } : {}),
							...(text(c.team) ? { team: text(c.team) } : {})
						}
					]
				: []
		);
		return [{ slug, name, author: text(row.author), characters }];
	});
}
