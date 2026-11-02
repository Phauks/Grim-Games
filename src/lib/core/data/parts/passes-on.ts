import { ALIGNMENTS, type Alignment } from '../types.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * When its ability is set off by its player's death (`onDeath`), another player becomes this
 * character: only `alive` players, and only those of `alignment` when given (the Farmer's
 * alive good player, https://wiki.bloodontheclocktower.com/Farmer). Read by
 * `rules/becomes.ts` (`passOnSeats`).
 */
export const passesOn = objectPart(
	'Passes on',
	'When its player dies, another player becomes this character.',
	(raw, path, issues): { alive?: true; alignment?: Alignment } | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['alive', 'alignment'], path, issues);
		const alive = readBoolean(raw, 'alive', path, issues);
		const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
		return { ...(alive ? { alive: true as const } : {}), ...(alignment ? { alignment } : {}) };
	}
);
