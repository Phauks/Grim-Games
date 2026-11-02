import { checkKeys, describe, isObject, readEnum, readNumber } from '../validate.ts';
import { objectPart } from './part.ts';

/** Who makes every nomination while the ability works: only the Storyteller. */
const NOMINATED_BY = ['storyteller'] as const;

/**
 * Who may nominate (`nominating`), one of:
 * - `by: 'storyteller'`: while its ability works, no player nominates, only the Storyteller,
 *   for the whole table (the Bishop, https://wiki.bloodontheclocktower.com/Bishop);
 * - `perGame`: its own player may nominate only this many times in the game (the Golem,
 *   https://wiki.bloodontheclocktower.com/Golem).
 * A nomination that breaks it is recorded with a warning (warn, never lock).
 */
export type Nominating = { by: (typeof NOMINATED_BY)[number] } | { perGame: number };

export const nominating = objectPart(
	'Who may nominate',
	'Only the Storyteller nominates, or its player may nominate only so many times a game.',
	(raw, path, issues): Nominating | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['by', 'perGame'], path, issues);
		const by = readEnum(raw, 'by', NOMINATED_BY, path, issues, false);
		const perGame = readNumber(raw, 'perGame', path, issues);
		if (perGame !== undefined && !(Number.isInteger(perGame) && perGame >= 1)) {
			issues.add(`${path}.perGame`, 'expected a whole number, 1 or more');
			return undefined;
		}
		if (by !== undefined && perGame !== undefined) {
			issues.add(path, 'expected only one of by or perGame');
			return undefined;
		}
		if (by !== undefined) return { by };
		if (perGame !== undefined) return { perGame };
		if (raw.by === undefined) issues.add(path, 'expected by or perGame');
		return undefined;
	}
);
