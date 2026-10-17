import { t } from '#lib/i18n/locale.svelte.ts';
import type { Character, CharacterId } from '#lib/core/data/index.ts';
import { NO_SETUP_REMINDERS, SETUP_REMINDER_ENTRIES } from '#lib/core/rules/index.ts';
import type {
	BagIssue,
	ScriptRequirement,
	SetupAnalysis,
	SetupWarning
} from '#lib/core/rules/index.ts';

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

/**
 * The setup analysis says to swap a Townsfolk for a required character (the Choirboy needs
 * the King, https://wiki.bloodontheclocktower.com/Choirboy). When that character isn't on
 * the script there is nothing to swap in, so the warning says so instead.
 */
export function setupWarningMessages(
	warnings: readonly SetupWarning[],
	requirements: readonly ScriptRequirement[],
	name: (id: CharacterId) => string
): string[] {
	const offScript = new Set(requirements.filter((r) => !r.onScript).map((r) => r.requires));
	return warnings.map((w) => {
		const [id, required] = w.characters ?? [];
		return w.code === 'missing-required' && id && required && offScript.has(required)
			? t('setup.check.notOnScript', { name: name(id), required: name(required) })
			: w.message;
	});
}

const CURATED: ReadonlySet<CharacterId> = new Set([
	...SETUP_REMINDER_ENTRIES.map((e) => e.id),
	...Object.keys(NO_SETUP_REMINDERS)
]);

/**
 * Custom characters in play whose reminder tokens the app can't place before the game
 * (Trevor, 2026-10-17): setup reminders come from our curated list of official characters,
 * and script JSON says nothing about which reminders go out at setup. Only characters with
 * reminders are named; one without any has nothing to place.
 */
export function uncuratedReminderCharacters(inPlay: readonly Character[]): CharacterId[] {
	const ids = inPlay
		.filter((c) => !CURATED.has(c.id) && c.reminders.length + c.remindersGlobal.length > 0)
		.map((c) => c.id);
	return [...new Set(ids)];
}
