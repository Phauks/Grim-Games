import { CHARACTER_TYPES, type CharacterType } from '../types.ts';
import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/** What being nominated sets off: the nominator is executed straight away. */
const NOMINATED_EFFECTS = ['execute-nominator'] as const;
export type NominatedEffect = (typeof NOMINATED_EFFECTS)[number];

/**
 * The first time its player is nominated by a `by` character, `effect` happens (the
 * Virgin). Once used, the character's "No Ability" reminder marks it spent.
 */
export const onNominated = objectPart(
	'On nomination',
	'The first time its player is nominated by this type, something happens.',
	(raw, path, issues): { by: CharacterType; effect: NominatedEffect } | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['by', 'effect'], path, issues);
		const by = readEnum(raw, 'by', CHARACTER_TYPES, path, issues, true);
		const effect = readEnum(raw, 'effect', NOMINATED_EFFECTS, path, issues, true);
		return by && effect ? { by, effect } : undefined;
	}
);
