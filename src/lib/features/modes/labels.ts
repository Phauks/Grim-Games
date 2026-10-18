import { en } from '#lib/i18n/messages/en.ts';
import type { PlainMessageKey } from '#lib/i18n/catalog.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

/** The label for a mode file's part, field, kind or value; a name with none shows as itself. */
export function modeLabel(group: 'part' | 'field' | 'kind' | 'value', name: string): string {
	const key = `modes.${group}.${name}`;
	return key in en ? t(key as PlainMessageKey) : name;
}

/**
 * A field's label where it sits: a name read differently in one part has its own label (the
 * pool's `count` is how many hidden extras, a town's `count` how many towns).
 */
export function fieldLabel(parent: string, name: string): string {
	const key = `modes.field.${parent}.${name}`;
	return key in en ? t(key as PlainMessageKey) : modeLabel('field', name);
}

/** Fields holding lists of character ids, shown as badges. */
export const CHARACTER_FIELDS: ReadonlySet<string> = new Set([
	'banned',
	'notChoosable',
	'inPlay',
	'onScript',
	'ruleCharacters',
	'characters',
	'together',
	'grants'
]);

/** Number lists read as a sequence. */
export const SEQUENCE_FIELDS: ReadonlySet<string> = new Set(['offers', 'movesPerDay']);
