import type { Catalog } from '#lib/i18n/catalog.ts';
import { account } from '#lib/i18n/messages/en/account.ts';
import { common } from '#lib/i18n/messages/en/common.ts';
import { picker } from '#lib/i18n/messages/en/picker.ts';
import { setup } from '#lib/i18n/messages/en/setup.ts';
import { bluffs } from '#lib/i18n/messages/en/bluffs.ts';
import { infoTokens } from '#lib/i18n/messages/en/info-tokens.ts';
import { show } from '#lib/i18n/messages/en/show.ts';
import { errors } from '#lib/i18n/messages/en/errors.ts';
import { reports } from '#lib/i18n/messages/en/reports.ts';
import { player } from '#lib/i18n/messages/en/player.ts';
import { room } from '#lib/i18n/messages/en/room.ts';
import { share } from '#lib/i18n/messages/en/share.ts';
import { day } from '#lib/i18n/messages/en/day.ts';
import { scripts } from '#lib/i18n/messages/en/scripts.ts';
import { characters } from '#lib/i18n/messages/en/characters.ts';
import { glossary } from '#lib/i18n/messages/en/glossary.ts';
import { reference } from '#lib/i18n/messages/en/reference.ts';
import { shell } from '#lib/i18n/messages/en/shell.ts';
import { settings } from '#lib/i18n/messages/en/settings.ts';
import { scratch } from '#lib/i18n/messages/en/scratch.ts';
import { library } from '#lib/i18n/messages/en/library.ts';
import { history } from '#lib/i18n/messages/en/history.ts';
import { scriptBuilder } from '#lib/i18n/messages/en/script-builder.ts';
import { characterBuilder } from '#lib/i18n/messages/en/character-builder.ts';
import { modes } from '#lib/i18n/messages/en/modes.ts';
import { savant } from '#lib/i18n/messages/en/savant.ts';
import { friends } from '#lib/i18n/messages/en/friends.ts';

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
	...shell,
	...settings,
	...common,
	...setup,
	...picker,
	...errors,
	...reports,
	...room,
	...share,
	...show,
	...infoTokens,
	...bluffs,
	...day,
	...account,
	...scripts,
	...player,
	...characters,
	...glossary,
	...reference,
	...scratch,
	...library,
	...history,
	...friends,
	...scriptBuilder,
	...characterBuilder,
	...modes,
	...savant
} as const satisfies Catalog;
