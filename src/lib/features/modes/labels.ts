import { en } from '#lib/i18n/messages/en.ts';
import type { PlainMessageKey } from '#lib/i18n/catalog.ts';
import { t } from '#lib/i18n/locale.svelte.ts';

/** The label for a mode file's part, field, kind or value; a name with none shows as itself. */
export function modeLabel(group: 'part' | 'field' | 'kind' | 'value', name: string): string {
	const key = `modes.${group}.${name}`;
	return key in en ? t(key as PlainMessageKey) : name;
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
