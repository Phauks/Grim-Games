/**
 * Plain-words descriptions of rule data, for the Character reference page: when a pre-day
 * reminder shows (`describeWhen`) and the extra "is poisoned / is drunk" line
 * (`describeImpairable`). They read the same `DayCondition` the engine in
 * `day-reminders.ts` evaluates, so the page cannot drift from what the app does.
 */
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import { isSeatable } from '#lib/core/data/character-type.ts';
import type {
	DayCondition,
	DayReminderSpec,
	DeathCauseMatch
} from '#lib/core/data/day-reminder-rules.ts';

type Named = Pick<Character, 'name' | 'type'>;

const KNOWN_KEYS = new Set([
	'self',
	'reminder',
	'noReminder',
	'cause',
	'minAlive',
	'targetAlive',
	'nomineeChose'
]);

/** "killed by the Demon", "executed", "killed by the Assassin". */
export function describeCause(
	cause: DeathCauseMatch,
	name: (id: CharacterId) => string = (id) => id
): string {
	switch (cause) {
		case 'execution':
			return 'executed';
		case 'exile':
			return 'exiled';
		case 'demon':
			return 'killed by the Demon';
		case 'other':
			return 'died some other way';
		default:
			return `killed by the ${name(cause)}`;
	}
}

function list(parts: readonly string[], joiner: 'or' | 'and'): string {
	if (parts.length <= 1) return parts.join('');
	return `${parts.slice(0, -1).join(', ')} ${joiner} ${parts[parts.length - 1]}`;
}

/**
 * When a curated reminder shows, in plain words: "Witch is alive; a player has the
 * “Cursed” reminder (one line per player)". Fabled and Loric are never seated, so for
 * them "alive" means "in play". Any condition this function does not know yet is listed
 * as raw data rather than hidden, so the reference page shows it for review.
 */
export function describeWhen(
	spec: Pick<DayReminderSpec, 'when' | 'template'>,
	character: Named,
	name: (id: CharacterId) => string = (id) => id
): string {
	const when: DayCondition = spec.when ?? {};
	const seated = isSeatable(character.type);
	const n = character.name;
	const parts: string[] = [];
	const self = when.self ?? 'alive';
	if (!seated) parts.push(`${n} is in play`);
	else if (self === 'alive') parts.push(`${n} is alive`);
	else if (self === 'any') parts.push(`${n} is in play, alive or dead`);
	else if (when.cause?.length) {
		parts.push(
			`${n} is dead, ${list(
				when.cause.map((c) => describeCause(c, name)),
				'or'
			)} (shown, marked uncertain, when the cause was not recorded)`
		);
	} else parts.push(`${n} is dead`);
	if (when.cause?.length && (!seated || self !== 'dead')) {
		parts.push(
			`cause of death: ${list(
				when.cause.map((c) => describeCause(c, name)),
				'or'
			)}`
		);
	}
	if (when.reminder) {
		const perPlayer = spec.template.some((p) => 'target' in p);
		parts.push(
			`${when.targetAlive ? 'an alive' : 'a'} player has ${n}’s “${when.reminder}” reminder${perPlayer ? ' (one line per player)' : ''}`
		);
	}
	if (when.nomineeChose) parts.push('a nominee chose a player today (one line per nomination)');
	if (when.noReminder) parts.push(`no player has ${n}’s “${when.noReminder}” reminder`);
	if (when.minAlive !== undefined) parts.push(`at least ${when.minAlive} players are alive`);
	for (const [key, value] of Object.entries(when)) {
		if (!KNOWN_KEYS.has(key)) parts.push(`${key}: ${JSON.stringify(value)}`);
	}
	return parts.join('; ');
}

/** When the "is poisoned" / "is drunk" line shows for an `impairable` character. */
export function describeImpairable(character: Named): string {
	return `${character.name} is alive and a Poisoned or Drunk reminder (from any character) is on them`;
}
