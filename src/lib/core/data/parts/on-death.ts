import { checkKeys, describe, isObject, readBoolean, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/** Who did the killing: the Demon's kill, another ability's, or either. */
const KILLED_BY = ['demon', 'other', 'any'] as const;
export type KilledBy = (typeof KILLED_BY)[number];

/**
 * The ability is set off by its player's death, by `by` (the Ravenkeeper, the Sage); with
 * `night`, only a death at night, never an execution (the Ravenkeeper's "if you die at night").
 */
export const onDeath = objectPart(
	'On death',
	'The ability is set off by its player’s death.',
	(raw, path, issues): { by: KilledBy; night?: true } | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['by', 'night'], path, issues);
		const by = readEnum(raw, 'by', KILLED_BY, path, issues, true);
		const night = readBoolean(raw, 'night', path, issues);
		if (!by) return undefined;
		return night ? { by, night } : { by };
	}
);
