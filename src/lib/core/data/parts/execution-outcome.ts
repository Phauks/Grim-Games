import { oneOf, optObj, type SpecValue } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * When an execution fails while the ability works, whoever nominated: `only-evil-voted`, no
 * good player voted for the nominee, so their tally is zero and they are not executed (the
 * Legion, https://wiki.bloodontheclocktower.com/Legion).
 */
const FAILS_IF = oneOf(['only-evil-voted']);
export type ExecutionFailsIf = SpecValue<typeof FAILS_IF>;

/**
 * How its player may decide an execution themselves: `pass-or-fail`, once another player has
 * nominated, they force that nominee's execution to pass or to fail (the Judge,
 * https://wiki.bloodontheclocktower.com/Judge). A once-per-game use is marked as its
 * `dayUse` says.
 */
const FORCES = oneOf(['pass-or-fail']);
export type ExecutionForce = SpecValue<typeof FORCES>;

/**
 * When its player may execute a nominee straight away, whatever the tally: `good-voted`, at
 * least one good player voted for them (the Vizier,
 * https://wiki.bloodontheclocktower.com/Vizier).
 */
const EXECUTE_NOW = oneOf(['good-voted']);
export type ExecuteNow = SpecValue<typeof EXECUTE_NOW>;

/** How the ability fails, forces or hurries an execution (`rules/day/execution-outcome.ts`). */
export const executionOutcome = specPart(
	'Execution outcome',
	'Makes an execution fail, or lets its player force one to pass or fail.',
	optObj({ failsIf: FAILS_IF, force: FORCES, executeNow: EXECUTE_NOW }),
	(value, path, issues) => {
		if (Object.keys(value).length > 0) return value;
		issues.add(path, 'expected failsIf, force or executeNow');
		return undefined;
	}
);

/** What the ability does to an execution's outcome. */
export type ExecutionOutcomeRule = PartValue<typeof executionOutcome>;
