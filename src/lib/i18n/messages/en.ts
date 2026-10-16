import type { Catalog } from '#lib/i18n/catalog.ts';

/**
 * The English catalog: the source of truth for message keys and their placeholders.
 *
 * Keys are `<area>.<name>`, where the area is the feature folder that owns the text
 * (`common` for words every feature shares). A message is either a string with `{name}`
 * placeholders, or plural forms keyed by `Intl.PluralRules` category with a `{count}`.
 * Strings are added here as features move their text over; nothing else is translated yet.
 */
export const en = {
	'common.cancel': 'Cancel',
	'common.close': 'Close',
	'common.none': 'None',
	'common.seat': 'Seat {number}',
	'common.players': { one: '{count} player', other: '{count} players' }
} as const satisfies Catalog;
