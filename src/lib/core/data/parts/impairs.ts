import {
	B,
	byToken,
	NUM,
	obj,
	oneOf,
	opt,
	optObj,
	TOKEN,
	TOKENS,
	type SpecValue
} from '../field-spec.ts';
import { CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/** Why an ability does not work. `no-ability`: an effect such as the Preacher's. */
const REASON = oneOf(['drunk', 'poisoned', 'no-ability']);
export type ImpairmentReason = SpecValue<typeof REASON>;

/**
 * Who a reminder token impairs: `carrier`, the player it sits on (only a `type` character,
 * and with `whileWorks` only while this character's own ability works: the Preacher's "No
 * Ability"), or `others`, every other player except Travellers while the token is on the
 * board (the Minstrel's "Everyone Is Drunk"), only `type` players when given (the Xaan's "X"
 * poisons every Townsfolk). `whileKept`: only while a seat carrying this character's `token`
 * keeps their ability (`keepsAbility`), and with `nearest` only on that seat's nearest player
 * of that type either way round: the Vigormortis's Poisoned Townsfolk beside a Minion it
 * killed (M15g).
 */
const TOKEN_IMPAIRMENT = obj({
	reason: REASON,
	on: oneOf(['carrier', 'others']),
	type: opt(oneOf(CHARACTER_TYPES)),
	whileWorks: opt(B),
	whileKept: opt(obj({ token: TOKEN, nearest: opt(oneOf(CHARACTER_TYPES)) }))
});
export type TokenImpairment = SpecValue<typeof TOKEN_IMPAIRMENT>;

/**
 * How the ability leaves players drunk, poisoned or with no ability (`rules/abilities/ability.ts`).
 * `self`: its own player always is (the Drunk), or once at most `aliveAtMost` players live (the
 * Witch). `tokens`: what each of its reminders does, by label; an entry without `whileWorks`
 * lasts even once this character's ability ends (the Sweetheart's "from now on"). A reminder
 * with no entry here impairs its carrier when its label says "Poisoned" or "Drunk", only while
 * this character's ability works (https://wiki.bloodontheclocktower.com/Abilities). `clears`:
 * its reminders that make their carrier sober and healthy while its ability works (the
 * Barista's "Sober & Healthy"). `truthful`: its reminders whose carrier always gets true
 * information while its ability works, even when another ability says it must or may be false
 * (the Barista's "Sober & Healthy" under the Vortox).
 */
export const impairs = specPart(
	'Drunk, poisoned or no ability',
	'How the ability leaves players drunk, poisoned or with no ability.',
	optObj({
		self: obj({ reason: REASON, aliveAtMost: opt(NUM) }),
		tokens: byToken(TOKEN_IMPAIRMENT),
		clears: TOKENS,
		truthful: TOKENS
	})
);

export type Impairs = PartValue<typeof impairs>;
