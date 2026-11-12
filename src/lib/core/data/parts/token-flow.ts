import { obj, TOKENS } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * The `tokenFlow` part of a character's rules block (Trevor, 2026-11-06: "placing has should
 * request taking mad off ... certain tokens follow a flow"): its own reminders in the order
 * one takes the place of the one before on the same player, as each wiki How to Run says. The
 * Pixie's Mad gives way to Has Ability, the Shabaloth's Dead to Alive, the Pukka's Poisoned to
 * Dead. Placing a later one on a player who has an earlier one asks to take the earlier one
 * off (`rules/abilities/token-flow.ts`); the Storyteller may keep both (the Pukka's How to Run keeps
 * Poisoned by Dead while a death ability resolves), so it never happens on its own.
 */
export const tokenFlow = specPart(
	'tokens',
	'Token flow',
	'Its tokens that take the place of the one before on the same player, in order.',
	obj({ tokens: TOKENS }),
	(value, path, issues) => {
		if (value.tokens.length >= 2 && new Set(value.tokens).size === value.tokens.length)
			return value;
		issues.add(`${path}.tokens`, 'expected two or more different reminders, in order');
		return undefined;
	}
);

export type TokenFlow = PartValue<typeof tokenFlow>;
