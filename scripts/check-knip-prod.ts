/**
 * Lint: the app's code uses everything it exports (review H5, 2026-11-10). `knip` alone counts
 * tests as entries, so an export only a test uses passes; `knip --production` looks at the app
 * alone (the `!` entries and project files in `knip.jsonc`; test helpers are left out there).
 * Code only tests reach is either dead in the app or a seam the app should use.
 *
 * TESTS_ONLY_TODO lists what reached only tests when this lint started. It only shrinks: a new
 * entry fails the lint (use it in the app, or delete it and test what the app uses). An entry
 * the app now uses, or that is gone, is only reported, so PRs running in parallel never break
 * each other's lint on beta. Run by `npm run lint`.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Files and exports only tests used on 2026-11-11 (`file` or `file: export`); only shrinks. */
export const TESTS_ONLY_TODO: readonly string[] = [
	'src/lib/core/achievements/engine.ts: earned',
	'src/lib/core/achievements/engine.ts: progress',
	'src/lib/core/achievements/engine.ts: unlockedOptions',
	'src/lib/core/achievements/points.ts: balance',
	'src/lib/core/achievements/points.ts: pointsEarned',
	'src/lib/core/backgrounds/moving.ts: DEFAULT_MOVING_MOTION',
	'src/lib/core/backgrounds/moving.ts: formatParam',
	'src/lib/core/backgrounds/moving.ts: movingPreset',
	'src/lib/core/backgrounds/moving.ts: presetOf',
	'src/lib/core/backgrounds/still.ts: stillPreset',
	'src/lib/core/backgrounds/still.ts: stillPresetOf',
	'src/lib/core/codes/digit-code.ts: digitCodeBits',
	'src/lib/core/codes/digit-code.ts: formatDigitCode',
	'src/lib/core/codes/qr-frames.ts: qrFrames',
	'src/lib/core/codes/word-code.ts: makeWordCode',
	'src/lib/core/codes/word-code.ts: wordCodeBits',
	'src/lib/core/data/game-data.ts: checkScriptSchema',
	'src/lib/core/data/info-tokens.ts: infoTokens',
	'src/lib/core/data/jinx-rules.ts: JINX_FLAGS',
	'src/lib/core/data/parse.ts: parseScript',
	'src/lib/core/engine/log.ts: history',
	'src/lib/core/modes/builder.ts: issuesAt',
	'src/lib/core/modes/builder.ts: knownType',
	'src/lib/core/modes/format-guide.ts: documentedFields',
	'src/lib/core/modes/format-guide.ts: guideFingerprint',
	'src/lib/core/modes/pool.ts: demonBluffs',
	'src/lib/core/modes/rule-guide.ts: RULE_MINIMAL_EXAMPLE',
	'src/lib/core/modes/script-rule.ts: scriptSpecialRule',
	'src/lib/core/rules/abilities/ability-parts.ts: abilityAction',
	'src/lib/core/rules/abilities/becomes.ts: passOnSeats',
	'src/lib/core/rules/day/day-claims.ts: anyoneDayUses',
	'src/lib/core/rules/day/day-reminders.ts: impairment',
	'src/lib/core/rules/day/day-reminders.ts: renderReminder',
	'src/lib/core/rules/day/day-timer.ts: dayTimers.reset',
	'src/lib/core/rules/day/execution-outcome.ts: votersAnswer',
	'src/lib/core/rules/day/vote-weights.ts: tallyOf',
	'src/lib/core/rules/day/voting-table.ts: ghostVotesRestored',
	'src/lib/core/rules/game-clock.ts: gameClock.formatGameLength',
	'src/lib/core/rules/game-clock.ts: gameClock.gameLength',
	'src/lib/core/rules/game-end/end-reason.ts: alwaysWinners',
	'src/lib/core/rules/jinxes/jinxes.ts: jinxedWith',
	'src/lib/core/rules/night/info-token-characters.ts: filledInfoToken',
	'src/lib/core/rules/night/night-text.ts: SHOW_DIFFERS_FROM_SOURCE',
	'src/lib/core/rules/night/night-text.ts: nightTextPlain',
	'src/lib/core/rules/night/night-text.ts: placeholderProblems',
	'src/lib/core/rules/reference.ts: fullNightOrder',
	'src/lib/core/rules/reference.ts: referenceText',
	'src/lib/core/rules/reference.ts: sheetPosition',
	'src/lib/core/rules/reminders/reminder-movement.ts: isFixedReminder',
	'src/lib/core/rules/reminders/reminder-targets.ts: REMINDER_TARGETS',
	'src/lib/core/rules/reminders/reminder-targets.ts: reminderTargets',
	'src/lib/core/rules/savant/savant.ts: pairFits',
	'src/lib/core/rules/setup/late-seat-proposal.ts: lateSeatCounts',
	'src/lib/core/rules/setup/setup-reminders.ts: placeableSetupReminders',
	'src/lib/core/rules/setup/setup-reminders.ts: prepTokens',
	'src/lib/core/scratch/scratch.ts: isBlank',
	'src/lib/core/sync/grim-view-password.ts: GRIM_VIEW_PASSWORD_BITS',
	'src/lib/core/sync/public-projection.ts: NoopSyncProvider',
	'src/lib/core/sync/room.ts: MAX_MEMBERS',
	'src/lib/core/timestamp-name.ts: nameOrTimestamp',
	'src/lib/features/about/direct-commits.ts',
	'src/lib/features/about/report-issue.ts: ISSUE_FORMS',
	'src/lib/features/account/profile-scripts.ts: onlineSourceLabel',
	'src/lib/features/bluffs/bluffs.ts: demonBluffsInPlay',
	'src/lib/features/friends/friend-rules.ts: NO_RELATION',
	'src/lib/features/glossary/wiki-glossary.ts: entryText',
	'src/lib/features/board/reminder-fan.ts: reminderFan',
	'src/lib/features/board/reminders.ts: canAddCopy',
	'src/lib/features/board/reminders.ts: parseReminderKey',
	'src/lib/features/history/recap-html.ts: ALL_RECAP_PARTS',
	'src/lib/features/library/library-labels.ts: filterLibrary',
	'src/lib/features/library/script-changes.ts: hasChanges',
	'src/lib/features/modes/players-line.ts: tablePlayersLine',
	'src/lib/features/offline/chunk-renames.ts: describeChunks',
	'src/lib/features/reference/coverage.ts',
	'src/lib/features/reference/fields.ts: tableFieldIds',
	'src/lib/features/scripts/share.ts: shareLink',
	'src/lib/features/shell/nav.ts: NAV_ITEMS',
	'src/lib/features/test-room/game.ts: playGame',
	'src/lib/i18n/catalog.ts: checkTranslation',
	'src/lib/i18n/hardcoded.ts',
	'src/lib/i18n/migrated.ts',
	'src/lib/index.ts',
	'src/lib/ui/assistance.ts: STORYTELLER_HELP_KEYS',
	'src/lib/ui/icons/catalogue.ts: catalogueIconIds',
	'src/lib/ui/icons/catalogue.ts: defaultIconIds',
	'src/lib/ui/nested-flush/FlushingChild.svelte',
	'src/lib/ui/nested-flush/NestedFlush.svelte',
	'src/lib/ui/nested-flush/shared.svelte.ts',
	'src/lib/ui/seating/seat-layout.ts: pruneLayout',
	'src/lib/ui/seating/seat-layout.ts: towardsMiddle',
	'src/lib/ui/seating/seat-layout.ts: withShape',
	'src/lib/ui/seating/seat-layout.ts: withoutPlaced',
	'src/lib/ui/themes/types.ts: EDGE_PAIRS'
];

interface KnipIssue {
	file: string;
	files?: { name: string }[];
	exports?: { name: string; namespace?: string }[];
}

/** Each unused file, and each unused export as `file: name`, from knip's JSON report. */
export function findings(report: { issues: KnipIssue[] }): string[] {
	return report.issues
		.flatMap((i) => [
			...(i.files ?? []).map(() => i.file),
			...(i.exports ?? []).map((e) => `${i.file}: ${e.namespace ? `${e.namespace}.` : ''}${e.name}`)
		])
		.sort();
}

/** What is new (fails) and what the list can lose (reported only). */
export function compare(found: readonly string[], todo: readonly string[] = TESTS_ONLY_TODO) {
	return {
		added: found.filter((f) => !todo.includes(f)),
		gone: todo.filter((t) => !found.includes(t))
	};
}

if (process.argv.includes('--run')) {
	const root = fileURLToPath(new URL('..', import.meta.url));
	let out: string;
	try {
		out = execFileSync('npx', ['knip', '--production', '--no-progress', '--reporter', 'json'], {
			cwd: root,
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024
		});
	} catch (error) {
		// knip exits 1 when it reports anything; the report is still on stdout.
		out = (error as { stdout?: string }).stdout ?? '';
		if (!out) throw error;
	}
	const { added, gone } = compare(findings(JSON.parse(out) as { issues: KnipIssue[] }));
	for (const g of gone)
		console.log(`${g}: the app uses it now, or it is gone; take it off TESTS_ONLY_TODO.`);
	for (const a of added)
		console.error(
			`${a}: only tests use it. Use it in the app, or delete it and test what the app uses.`
		);
	if (added.length) process.exit(1);
}
