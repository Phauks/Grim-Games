import { en } from '#lib/i18n/messages/en.ts';
import type { PlainMessageKey } from '#lib/i18n/catalog.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import * as PARTS from '#lib/core/data/parts/index.ts';

/**
 * The label for a mode file's part, field, kind or value; a name with none shows as itself. A
 * part of the file's rules block (`rules.<part>`) shows as the part's own label.
 */
export function modeLabel(group: 'part' | 'field' | 'kind' | 'value', name: string): string {
	if (group === 'part' && name.startsWith('rules.')) return rulesPartLabel(name.slice(6));
	const key = `modes.${group}.${name}`;
	return key in en ? t(key as PlainMessageKey) : name;
}

/** A rules block part's own label (`data/parts/`), or its name when it has none. */
export function rulesPartLabel(name: string): string {
	return Object.hasOwn(PARTS, name) ? PARTS[name as keyof typeof PARTS].label : name;
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
