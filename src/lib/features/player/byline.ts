/**
 * A script's byline as words (Trevor, 2026-10-17): its author, version and, in a game, the
 * Storyteller, each left out when unknown. ScriptByline shows it; a game's share text
 * carries it (Trevor, 2026-10-19), so both read the same.
 */
import { t } from '#lib/i18n/locale.svelte.ts';

export interface Byline {
	author?: string;
	version?: string;
	storyteller?: string;
}

/** "by Author", "vN" and "Storyteller: Name", in that order, for the ones known. */
export function bylineParts({ author, version, storyteller }: Byline): string[] {
	return [
		author?.trim() ? t('player.byAuthor', { author: author.trim() }) : undefined,
		version?.trim() ? t('player.version', { version: version.trim() }) : undefined,
		storyteller?.trim() ? t('player.storytellerIs', { name: storyteller.trim() }) : undefined
	].filter((p) => p !== undefined);
}

/**
 * A game in one line: "Trouble Brewing v2 by The Pandemonium Institute · Storyteller: Sam".
 * Empty when nothing is known.
 */
export function gameLine(name: string | undefined, byline: Byline): string {
	const title = [
		name?.trim(),
		byline.version?.trim() && t('player.version', { version: byline.version.trim() })
	]
		.filter(Boolean)
		.join(' ');
	const by = byline.author?.trim() ? t('player.byAuthor', { author: byline.author.trim() }) : '';
	const head = [title, by].filter(Boolean).join(' ');
	const storyteller = bylineParts({ storyteller: byline.storyteller });
	return [head, ...storyteller].filter(Boolean).join(' · ');
}
