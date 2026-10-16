import { getContext, setContext } from 'svelte';
import type { GlossaryTerm } from '#lib/core/rules/glossary.ts';

const KEY = Symbol('glossary-term-handler');

/**
 * Inside the Glossary itself (its dialog and popover), a tapped term opens that entry in
 * place instead of a new popover over it.
 */
export function setTermHandler(open: (term: GlossaryTerm) => void): void {
	setContext(KEY, open);
}

/** Back to the popover, e.g. in character details opened from a Glossary entry. */
export function clearTermHandler(): void {
	setContext(KEY, undefined);
}

export function getTermHandler(): ((term: GlossaryTerm) => void) | undefined {
	return getContext(KEY);
}
