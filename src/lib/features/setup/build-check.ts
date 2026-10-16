import { t } from '#lib/i18n/locale.svelte.ts';
import type { BagIssue, SetupAnalysis, SetupWarning } from '#lib/core/rules/index.ts';

/**
 * Problems that make the bag wrong for this table, which the Storyteller must confirm
 * before building it (Trevor, 2026-10-16). Everything else the Check dialog lists (setup
 * text it can't read, Lil' Monsta, rule characters, jinxes) is a note and never stops the
 * build. The Storyteller can still build anyway: the app warns, it never locks.
 */
const ERROR_WARNINGS: ReadonlySet<SetupWarning['code']> = new Set([
	'player-count',
	'count-mismatch',
	'total-mismatch',
	'missing-required',
	'duplicate'
]);
const ERROR_ISSUES: ReadonlySet<BagIssue['code']> = new Set(['no-stand-in', 'unknown-character']);

export interface BuildCheckInput {
	analysis: SetupAnalysis;
	issues: readonly BagIssue[];
	/** Travellers selected. */
	travellers: number;
}

/** The errors to confirm before building the bag, as messages; empty when it is clean. */
export function buildErrors({ analysis, issues, travellers }: BuildCheckInput): string[] {
	const errors = [
		...analysis.warnings.filter((w) => ERROR_WARNINGS.has(w.code)).map((w) => w.message),
		...issues.filter((i) => ERROR_ISSUES.has(i.code)).map((i) => i.message)
	];
	// Players beyond 15 join as Travellers (https://wiki.bloodontheclocktower.com/Setup).
	if (travellers < analysis.travellers) {
		errors.push(
			t('setup.errors.travellers', {
				count: travellers,
				expected: analysis.travellers,
				players: analysis.players
			})
		);
	}
	return errors;
}
