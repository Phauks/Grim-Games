/**
 * The `falseInfo` part of a character's rules block: while its ability works, the information
 * of these types' abilities must be false (the Vortox's Townsfolk,
 * https://wiki.bloodontheclocktower.com/Vortox); with `may`, it may be false instead, for
 * players of `alignment` (and `types`, when given), until its `spentToken` is placed (the
 * Fibbin: once per game, a good player, https://wiki.bloodontheclocktower.com/Fibbin).
 * Read by `rules/night-info/reliability.ts`.
 */
import { readToken } from './reminder-fields.ts';
import { readTypes } from './target-rules.ts';
import { ALIGNMENTS, type Alignment, type CharacterType, type ReminderLabel } from './types.ts';
import { checkKeys, describe, isObject, readBoolean, readEnum, type Issues } from './validate.ts';

export interface FalseInfo {
	/** Required unless `may`. */
	types?: readonly CharacterType[];
	may?: true;
	alignment?: Alignment;
	spentToken?: ReminderLabel;
}

export function readFalseInfo(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders?: readonly ReminderLabel[]
): FalseInfo | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['types', 'may', 'alignment', 'spentToken'], path, issues);
	const may = readBoolean(raw, 'may', path, issues);
	if (may === false) issues.add(`${path}.may`, 'expected true');
	if (raw.types === undefined && !may) issues.add(`${path}.types`, 'required');
	const types = readTypes(raw, 'types', path, issues);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	const spentToken = readToken(raw, 'spentToken', path, issues, reminders);
	if (!may) return types ? { types } : undefined;
	return {
		may: true,
		...(types ? { types } : {}),
		...(alignment ? { alignment } : {}),
		...(spentToken ? { spentToken } : {})
	};
}
