import type { Catalog } from '#lib/i18n/catalog.ts';
import { common } from '#lib/i18n/messages/en/common.ts';
import { bluffs } from '#lib/i18n/messages/en/bluffs.ts';
import { infoTokens } from '#lib/i18n/messages/en/info-tokens.ts';
import { show } from '#lib/i18n/messages/en/show.ts';
import { errors } from '#lib/i18n/messages/en/errors.ts';
import { room } from '#lib/i18n/messages/en/room.ts';

/**
 * The English catalog: the source of truth for message keys and their placeholders.
 *
 * Each area keeps its English in its own file under messages/en/ (one per feature folder,
 * plus `common` for shared words), so threads moving their text don't edit the same file.
 * Keys are written out in full as `<area>.<name>` so a search for a key finds its use.
 * A message is either a string with `{name}` placeholders, or plural forms keyed by
 * `Intl.PluralRules` category with a `{count}`.
 */
export const en = {
	...common,
	...errors,
	...room,
	...show,
	...infoTokens,
	...bluffs
} as const satisfies Catalog;
