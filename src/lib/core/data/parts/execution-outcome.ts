import { checkKeys, describe, isObject, readEnum } from '../validate.ts';
import { objectPart } from './part.ts';

/**
 * When an execution fails while the ability works, whoever nominated: `only-evil-voted`, no
 * good player voted for the nominee, so their tally is zero and they are not executed (the
 * Legion, https://wiki.bloodontheclocktower.com/Legion).
 */
const FAILS_IF = ['only-evil-voted'] as const;
export type ExecutionFailsIf = (typeof FAILS_IF)[number];

/**
 * How its player may decide an execution themselves: `pass-or-fail`, once another player has
 * nominated, they force that nominee's execution to pass or to fail (the Judge,
 * https://wiki.bloodontheclocktower.com/Judge). A once-per-game use is marked as its
 * `dayUse` says.
 */
const FORCES = ['pass-or-fail'] as const;
export type ExecutionForce = (typeof FORCES)[number];

/**
 * When its player may execute a nominee straight away, whatever the tally: `good-voted`, at
 * least one good player voted for them (the Vizier,
 * https://wiki.bloodontheclocktower.com/Vizier).
 */
const EXECUTE_NOW = ['good-voted'] as const;
export type ExecuteNow = (typeof EXECUTE_NOW)[number];

/** What the ability does to an execution's outcome (`rules/execution-outcome.ts`). */
export interface ExecutionOutcomeRule {
	failsIf?: ExecutionFailsIf;
	force?: ExecutionForce;
	executeNow?: ExecuteNow;
}

/** How the ability fails, forces or hurries an execution. */
export const executionOutcome = objectPart(
	'Execution outcome',
	'Makes an execution fail, or lets its player force one to pass or fail.',
	(raw, path, issues): ExecutionOutcomeRule | undefined => {
		if (!isObject(raw)) {
			issues.add(path, `expected object, got ${describe(raw)}`);
			return undefined;
		}
		checkKeys(raw, ['failsIf', 'force', 'executeNow'], path, issues);
		const failsIf = readEnum(raw, 'failsIf', FAILS_IF, path, issues, false);
		const force = readEnum(raw, 'force', FORCES, path, issues, false);
		const executeNow = readEnum(raw, 'executeNow', EXECUTE_NOW, path, issues, false);
		const rule: ExecutionOutcomeRule = {
			...(failsIf ? { failsIf } : {}),
			...(force ? { force } : {}),
			...(executeNow ? { executeNow } : {})
		};
		if (Object.keys(rule).length > 0) return rule;
		issues.add(path, 'expected failsIf, force or executeNow');
		return undefined;
	}
);
