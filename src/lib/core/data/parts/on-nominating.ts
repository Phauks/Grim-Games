import { obj, oneOf, opt, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * What nominating sets off:
 * - `kills-nominator`: the nominator dies straight away, and the nomination still stands (the
 *   Witch's Cursed, https://wiki.bloodontheclocktower.com/Witch).
 */
const NOMINATING_EFFECTS = ['kills-nominator'] as const;
export type NominatingEffect = (typeof NOMINATING_EFFECTS)[number];

/**
 * A nomination by its own player, or with `carrier`, by the player carrying that reminder of
 * the character (the Witch's Cursed), that sets off `effect`.
 */
export const onNominating = specPart(
	'day',
	'On nominating',
	'When its player, or the player with one of its reminders, nominates, something happens.',
	obj({ carrier: opt(TOKEN), effect: oneOf(NOMINATING_EFFECTS) })
);

export type OnNominating = PartValue<typeof onNominating>;
