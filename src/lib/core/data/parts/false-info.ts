import { anyOf, oneOf, optObj, T, TOKEN } from '../field-spec.ts';
import { ALIGNMENTS, CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * The `falseInfo` part of a character's rules block: while its ability works, the information
 * of these types' abilities must be false (the Vortox's Townsfolk,
 * https://wiki.bloodontheclocktower.com/Vortox); with `may`, it may be false instead, for
 * players of `alignment` (and `types`, when given), until its `spentToken` is placed (the
 * Fibbin: once per game, a good player, https://wiki.bloodontheclocktower.com/Fibbin).
 * Read by `rules/night/info/reliability.ts`.
 */
export const falseInfo = specPart(
	'night',
	'False information',
	'These character types’ information must be false.',
	optObj({
		types: anyOf(CHARACTER_TYPES),
		may: T,
		alignment: oneOf(ALIGNMENTS),
		spentToken: TOKEN
	}),
	(value, path, issues) => {
		if (value.may) return value;
		// Without `may`, only `types` says anything: their information must be false.
		if (value.types) return { types: value.types };
		issues.add(`${path}.types`, 'required');
		return undefined;
	}
);

export type FalseInfo = PartValue<typeof falseInfo>;
