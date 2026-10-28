/**
 * The `falseInfo` part of a character's rules block: while its ability works, the information
 * of these types' abilities must be false (the Vortox's Townsfolk,
 * https://wiki.bloodontheclocktower.com/Vortox). Read by `rules/night-info/reliability.ts`.
 */
import { readTypes } from './target-rules.ts';
import type { CharacterType } from './types.ts';
import { checkKeys, describe, isObject, type Issues } from './validate.ts';

export interface FalseInfo {
	types: readonly CharacterType[];
}

export function readFalseInfo(raw: unknown, path: string, issues: Issues): FalseInfo | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['types'], path, issues);
	if (raw.types === undefined) issues.add(`${path}.types`, 'required');
	const types = readTypes(raw, 'types', path, issues);
	return types ? { types } : undefined;
}
