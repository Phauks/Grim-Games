/**
 * The `execution` part of a character's rules block: what its ability does around an
 * execution. It names a behaviour, never a character:
 * - `insteadOf: 'same-alignment'`: the Storyteller may execute this player instead of a player
 *   of the same alignment (the Scapegoat, https://wiki.bloodontheclocktower.com/Scapegoat).
 *   The execution dialog offers it (`rules/executed-instead.ts`).
 */
import { checkKeys, describe, isObject, readEnum, type Issues } from './validate.ts';

export const EXECUTED_INSTEAD_OF = ['same-alignment'] as const;

export interface ExecutionRule {
	insteadOf?: (typeof EXECUTED_INSTEAD_OF)[number];
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
	checkKeys(raw, ['insteadOf'], path, issues);
	const insteadOf = readEnum(raw, 'insteadOf', EXECUTED_INSTEAD_OF, path, issues, false);
	return insteadOf ? { insteadOf } : undefined;
}
