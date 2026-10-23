import { OFFICIAL_EDITIONS } from './script.ts';
import type { Character } from './types.ts';

export const WIKI_ORIGIN = 'https://wiki.bloodontheclocktower.com';

/**
 * The official wiki page for a character. MediaWiki titles use underscores for spaces;
 * other characters (apostrophes, ampersands) are percent-encoded. Homebrew characters
 * have no wiki page.
 */
export function wikiUrl(character: Pick<Character, 'name' | 'edition'>): string | undefined {
	if (!character.edition) return undefined;
	const title = character.name.trim().replace(/ /g, '_');
	return `${WIKI_ORIGIN}/${encodeURIComponent(title).replace(/%2F/g, '/')}`;
}

/**
 * The wiki page of a base script (Trouble Brewing, Bad Moon Rising, Sects & Violets) by its
 * edition id: the source page those scripts link to (Trevor, 2026-10-23).
 */
export function editionWikiUrl(edition: string | undefined): string | undefined {
	const found = OFFICIAL_EDITIONS.find((e) => e.id === edition);
	return found && wikiUrl({ name: found.name, edition: found.id });
}
