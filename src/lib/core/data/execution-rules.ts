/**
 * The `execution` part of a character's rules block: what its ability does around an
 * execution. It names a behaviour, never a character:
 * - `insteadOf: 'same-alignment'`: the Storyteller may execute this player instead of a player
 *   of the same alignment (the Scapegoat, https://wiki.bloodontheclocktower.com/Scapegoat).
 *   The execution dialog offers it (`rules/executed-instead.ts`);
 * - `explodes`: executed (whether or not they die of it), all but this many players die, then the players point
 *   and the one most pointed at dies (the Boomdandy's 3,
 *   https://wiki.bloodontheclocktower.com/Boomdandy). The board asks who lives, then who was
 *   pointed at most (`rules/explosion.ts`).
 */
import { checkKeys, describe, isObject, readEnum, readNumber, type Issues } from './validate.ts';

export const EXECUTED_INSTEAD_OF = ['same-alignment'] as const;

export interface ExecutionRule {
	insteadOf?: (typeof EXECUTED_INSTEAD_OF)[number];
	explodes?: number;
}

/** Reads an `execution` block. Undefined when absent. */
export function readExecution(
	raw: unknown,
	path: string,
	issues: Issues
): ExecutionRule | undefined {
	if (raw === undefined) return undefined;
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['insteadOf', 'explodes'], path, issues);
	const insteadOf = readEnum(raw, 'insteadOf', EXECUTED_INSTEAD_OF, path, issues, false);
	const explodes = readNumber(raw, 'explodes', path, issues);
	const survivors = explodes !== undefined && Number.isInteger(explodes) && explodes > 0;
	if (explodes !== undefined && !survivors)
		issues.add(`${path}.explodes`, 'expected a whole number of survivors, 1 or more');
	const rule: ExecutionRule = {
		...(insteadOf ? { insteadOf } : {}),
		...(survivors ? { explodes } : {})
	};
	return Object.keys(rule).length > 0 ? rule : undefined;
}
