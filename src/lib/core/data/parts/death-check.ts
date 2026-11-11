import { obj, oneOf, opt, TOKEN, type SpecValue } from '../field-spec.ts';
import { specPart } from './part.ts';

/**
 * Night deaths the ability itself decides (`rules/night-deaths.ts`):
 * - `wrong-guess`: the player guesses a player's character and dies if wrong (the Gambler);
 * - `chose-impaired`: the player dies if their pick is drunk or poisoned (the Acrobat);
 * - `chosen-good-dies`: a chosen good player dies and the Demon does not kill (the Lycanthrope);
 * - `marked-killed-by-demon`: the player dies when the Demon kills whoever carries `token`
 *   (the Grandmother's Grandchild).
 */
const KIND = oneOf(['wrong-guess', 'chose-impaired', 'chosen-good-dies', 'marked-killed-by-demon']);
export type DeathCheckKind = SpecValue<typeof KIND>;

/** A night death its own ability decides (`rules/night-deaths.ts`). */
export const deathCheck = specPart(
	'Death check',
	'A night death its own ability decides.',
	obj({ kind: KIND, token: opt(TOKEN) }),
	(value, path, issues) => {
		if (value.kind !== 'marked-killed-by-demon' || value.token) return value;
		issues.add(`${path}.token`, 'missing');
		return undefined;
	}
);
