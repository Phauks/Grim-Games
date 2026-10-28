/**
 * What the Reference table's columns without their own filter hold for each character, as
 * plain text for the shared table's built-in filters (DataTable `value`): the same text each
 * cell shows (FieldValue.svelte), without its badges and chips.
 */
import { characterIcons, type Character } from '#lib/core/data/index.ts';
import type { ReferenceEntry } from '#lib/core/rules/reference.ts';
import { setupPrep } from '#lib/core/rules/setup-reminders.ts';
import { cardsOfCharacter } from '#lib/features/info-tokens/character-cards.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import type { FilterValue } from '#lib/ui/table/column-filter.ts';
import type { FieldId } from './fields.ts';
import { EDITION_LABELS } from './labels.ts';

export function fieldFilterValue(entry: ReferenceEntry, field: FieldId): FilterValue {
	const character = entry.character;
	switch (field) {
		case 'edition':
			return character.edition ? (EDITION_LABELS[character.edition] ?? character.edition) : '';
		case 'icons':
			return iconLabels(character);
		case 'ability':
			return character.ability;
		case 'flavor':
			return character.flavor ?? '';
		case 'prep':
			return setupPrep(character.id, character.name, new Map([[character.id, character]])).map(
				(step) => step.text
			);
		case 'special':
			return (character.special ?? []).map((s) => `${s.type}: ${s.name}`);
		case 'cards':
			return cardsOfCharacter(character).map((card) => t(card.titleKey));
		case 'problems':
			return entry.problems;
		default:
			return undefined;
	}
}

/** Which icons a character has, by the alignment each shows (the Icons column). */
function iconLabels(character: Character): string[] {
	const set = characterIcons(character);
	if (!set) return [];
	return [
		set.good && t('reference.iconGood'),
		set.evil && t('reference.iconEvil'),
		set.unaligned && t('reference.iconUnaligned')
	].filter((label): label is string => !!label);
}
