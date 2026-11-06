import { SEATED_TYPES, type SeatedType } from '../types.ts';
import { checkKeys, describe, isObject, type Issues } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * Who has an ability while a rule source with this part is in play: dead players keep theirs,
 * except those of a `deadLose` type, and living players of a `livingLose` type have none until
 * they die (The Phantom Detectives,
 * https://schnauzerclub.neocities.org/scripts/thephantomdetectives; `modes/rule-effects.ts`).
 */
export interface DeadKeepAbilities {
	deadLose: SeatedType[];
	livingLose: SeatedType[];
}

function readTypes(raw: Record<string, unknown>, key: string, path: string, issues: Issues) {
	const value = raw[key];
	if (value === undefined) return [];
	if (
		!Array.isArray(value) ||
		value.some((v) => !(SEATED_TYPES as readonly unknown[]).includes(v))
	) {
		issues.add(`${path}.${key}`, `expected a list of ${SEATED_TYPES.join(', ')}`);
		return undefined;
	}
	return value as SeatedType[];
}

function readDeadKeepAbilities(
	raw: unknown,
	path: string,
	issues: Issues
): DeadKeepAbilities | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['deadLose', 'livingLose'], path, issues);
	const deadLose = readTypes(raw, 'deadLose', path, issues);
	const livingLose = readTypes(raw, 'livingLose', path, issues);
	return deadLose && livingLose ? { deadLose, livingLose } : undefined;
}

/** While in play, dead players keep their abilities, and some living ones have none. */
export const deadKeepAbilities = objectPart(
	'Dead keep abilities',
	'While in play, dead players keep their abilities, except some types, and living players of some types have none until they die.',
	readDeadKeepAbilities
);
