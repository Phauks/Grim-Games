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
