import { glossaryBlock, type GlossarySegment } from '#lib/core/rules/glossary.ts';
import { officialData } from '#lib/features/characters/game-data.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';

/** Whether the Storyteller wants rules terms explained (Settings › Rules terms). */
export function explainTerms(): boolean {
	return preferences.current.assistance.explainTerms;
}

/**
 * The pieces of one block of game text with Glossary terms marked, or as plain text when
 * the "Underline rules terms" switch is off. Character names ("the Drunk") are never marked;
 * `names` adds any not in the official data (homebrew). Reactive when called in `$derived`.
 */
export function explainBlock(
	texts: readonly string[],
	names: readonly string[] = [],
	/** Term ids left unmarked, e.g. the Glossary entry the text belongs to. */
	skip: readonly string[] = []
): GlossarySegment[][] {
	if (!explainTerms()) return texts.map((text) => (text ? [{ kind: 'text', text }] : []));
	const official = officialData.current?.characters.map((c) => c.name) ?? [];
	return glossaryBlock(texts, { exclude: [...official, ...names], skip });
}
