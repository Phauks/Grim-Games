import { obj, optObj, STR, type SpecValue } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/** Our text, and one line on why it differs from the original. */
const OVERRIDE = obj({ text: STR, reason: STR });
const NIGHT = optObj({ reviewed: OVERRIDE, full: OVERRIDE });

export type NightTextOverride = SpecValue<typeof OVERRIDE>;

/**
 * Our own Storyteller night text in place of the character's: the `nightText` part of its
 * rules block, read here and used by `rules/night-text.ts`. Per night (`first`, `other`):
 * - `reviewed`: Trevor's reviewed edit, always used;
 * - `full`: fuller text where TPI's does not say which reminder tokens to place or remove and
 *   when (Trevor asked for it, then parked it: shown only while `FULL_NIGHT_INSTRUCTIONS` is on).
 *
 * Text uses TPI's markup: `*TOKEN*` for one of the character's reminder tokens or an info token,
 * `*DEAD*` for the death marker. `full` text never uses `:reminder:` (it names the token
 * instead); a reviewed edit may keep the original's `:reminder:`s, mapped by its
 * `reminderPlaceholders`. Character names need no markup: they are always drawn as badges.
 *
 * Wording is short and our own, paraphrasing the character's wiki page; `reason` says in one
 * line why ours differs.
 */
export const nightText = specPart(
	'Night text',
	'Our own night text in place of the original.',
	optObj({ first: NIGHT, other: NIGHT }),
	(value, path, issues) => {
		const marked = (['first', 'other'] as const).filter((night) =>
			value[night]?.full?.text.includes(':reminder:')
		);
		for (const night of marked) {
			issues.add(`${path}.${night}.full.text`, 'uses :reminder:; name the token instead');
		}
		return marked.length ? undefined : value;
	}
);

export type NightTextRules = PartValue<typeof nightText>;
