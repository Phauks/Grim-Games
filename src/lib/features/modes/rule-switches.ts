import type { SpecialRule } from '#lib/core/modes/index.ts';

/**
 * A built-in rule's own switches on New game, under the rule in the Special rules dialog
 * (Trevor, 2026-10-22: "add setting for +1"; then the same settings for A Script of Infinite
 * Possibilities). A switch changes the copy of the rule the game keeps; the rule file itself
 * never changes.
 */
export interface RuleSwitch {
	id: string;
	/** i18n key of the switch's label, which may depend on the rule it belongs to. */
	label: (ruleId: string) => SwitchLabel;
	/** How the rule file plays without the switch being touched. */
	default: boolean;
	apply: (rule: SpecialRule, on: boolean) => SpecialRule;
}

export type SwitchLabel =
	| 'modes.switch.namedOne'
	| 'modes.switch.namedMany'
	| 'modes.switch.mayBeNone'
	| 'modes.switch.threeAlive'
	| 'modes.switch.duplicateDemons'
	| 'modes.switch.terrifyingWhisper'
	| 'modes.switch.seatsRiseUp'
	| 'modes.switch.amnesiacAtHome';

/** The Storyteller's switch choices, by `ruleId:switchId`; a missing one is its default. */
export type SwitchChoices = Readonly<Record<string, boolean>>;

/** +1's two instructions, both Trevor's wording (2026-10-22); the first is the rule's own. */
export const PLUS_ONE_NAMED = 'Tell the table which character from off the script is in play.';
/** Infinite Possibilities' named setting, our wording (approved 2026-10-23). */
export const INFINITE_NAMED = 'Tell the table which characters from off the script are in play.';
/** +1 with no extra promised, our wording (drafted 2026-11-12, waiting on Trevor). */
export const PLUS_ONE_MAY_BE =
	'Tell the table that one character from off the script may be in play.';

/**
 * +1 and Infinite Possibilities are the same part underneath (hidden characters from off the
 * script, `script-plus-hidden`), so they share these switches (Trevor, 2026-10-22: "internally
 * they are very similar"; they stay two rules).
 */
const EXTRAS: readonly RuleSwitch[] = [
	{
		id: 'named',
		// Trevor (2026-10-23): "Storyteller Announces Character"; plural for Infinite
		// Possibilities, which may hide several.
		label: (ruleId) => (ruleId === 'plus-one' ? 'modes.switch.namedOne' : 'modes.switch.namedMany'),
		default: false,
		apply: (rule, on) => {
			if (!on) return rule;
			const text = rule.id === 'plus-one' ? PLUS_ONE_NAMED : INFINITE_NAMED;
			const [first, ...rest] = rule.setup.information ?? [];
			const pool = rule.setup.pool;
			return {
				...rule,
				setup: {
					...rule.setup,
					// Naming them says more than a range, so no range is offered.
					...(pool?.kind === 'script-plus-hidden'
						? { pool: { ...pool, announceRange: false } }
						: {}),
					information: [{ ...first, instructions: text }, ...rest]
				}
			};
		}
	},
	{
		// Trevor (2026-10-22): +1 and Infinite Possibilities always deal their extras, but a
		// game where they may be in play "would be beneficial to be built". On, none may be
		// dealt: the count starts at 0, so rolling may deal none and the range starts at 0.
		id: 'may-be-none',
		label: () => 'modes.switch.mayBeNone',
		default: false,
		apply: (rule, on) => {
			const pool = rule.setup.pool;
			if (!on || pool?.kind !== 'script-plus-hidden') return rule;
			const rows = Object.values(pool.extras).reduce((a, n) => a + (n ?? 0), 0);
			const count = { min: 0, max: pool.count?.max ?? rows };
			// +1's own line promises one; it now says one may be in play, unless named.
			const [first, ...rest] = rule.setup.information ?? [];
			const promised = rule.id === 'plus-one' && first?.instructions !== PLUS_ONE_NAMED;
			return {
				...rule,
				setup: {
					...rule.setup,
					pool: { ...pool, count },
					...(promised
						? { information: [{ ...first, instructions: PLUS_ONE_MAY_BE }, ...rest] }
						: {})
				}
			};
		}
	}
];

/** The Djinn's Bargain's 3-player limit, from the author's notes; our wording (approved). */
export const DJINN_THREE_ALIVE =
	'While only 3 players are alive, no one may choose to die this way.';

/**
 * The Djinn's Bargain's page (https://beardytas.com/garden-of-djinn/the-djinns-bargain/) bars
 * the bargain while only 3 players live, a line its rule text leaves out (Trevor, 2026-10-23:
 * "include the 3-player limit as a setting"). Off by default, as the rule text plays.
 */
const DJINN: readonly RuleSwitch[] = [
	{
		id: 'three-alive',
		label: () => 'modes.switch.threeAlive',
		default: false,
		apply: (rule, on) => {
			if (!on) return rule;
			const [first, ...rest] = rule.setup.ruleChanges ?? [];
			return {
				...rule,
				// The prompt on a nomination is offered only while 4 or more live.
				...(rule.rules?.onNominated
					? { rules: { ...rule.rules, onNominated: { ...rule.rules.onNominated, minAlive: 4 } } }
					: {}),
				setup: {
					...rule.setup,
					ruleChanges: [
						{ ...first, instructions: `${first?.instructions ?? ''} ${DJINN_THREE_ALIVE}`.trim() },
						...rest
					]
				}
			};
		}
	}
];

/** Duplicate Characters with Demons repeating too; our wording (approved 2026-10-26). */
export const DUPLICATE_DEMONS = 'You may put more than one copy of a character in the bag.';

/**
 * Duplicate Characters keeps Demons to one copy each, since several could make a game too hard
 * to win; this switch lets them repeat as well (Trevor, 2026-10-24: "allow duplicate demons
 * could be a setting"). Off by default.
 */
const DUPLICATES: readonly RuleSwitch[] = [
	{
		id: 'demons',
		label: () => 'modes.switch.duplicateDemons',
		default: false,
		apply: (rule, on) => {
			const duplicates = rule.setup.duplicates;
			if (!on || duplicates?.kind !== 'allowed') return rule;
			return {
				...rule,
				setup: {
					...rule.setup,
					duplicates: {
						...duplicates,
						notTypes: duplicates.notTypes?.filter((type) => type !== 'demon'),
						instructions: DUPLICATE_DEMONS
					}
				}
			};
		}
	}
];

/** Seat 7 under A Terrifying Whisper; our wording (drafted 2026-11-12, waiting on Trevor). */
export const SEAT_7_WHISPER =
	'One seat is dealt a character as usual, but no one plays it. Make its choices arbitrarily. You may speak for it twice: once privately and once publicly.';

/** Seat 7 under Seats Rise Up; our wording (drafted 2026-11-12, waiting on Trevor). */
export const SEAT_7_RISE_UP =
	'Once per day, while the seat still has a vote, you may add its vote to one nomination, before the next nomination is made. Announce it before the players vote.';
/** Seat 7 under Amnesiac at Home; our wording (drafted 2026-11-12, waiting on Trevor). */
export const SEAT_7_AT_HOME =
	'If a new player sits in the seat during the game, you may let them stay and speak for it. Don’t tell them its character or anything it learned.';

/** The rule with one more Storyteller instruction after its own. */
function withInstruction(rule: SpecialRule, instructions: string): SpecialRule {
	return {
		...rule,
		setup: { ...rule.setup, ruleChanges: [...(rule.setup.ruleChanges ?? []), { instructions }] }
	};
}

/**
 * The Ballad of Seat 7's optional rules from its page
 * (https://beardytas.com/garden-of-djinn/the-ballad-of-seat-7/), each a switch, off by default
 * (Trevor, 2026-10-22: "leave seat 7 optional rules in to do"; built 2026-11-12). A Terrifying
 * Whisper: "The Seat may speak twice per game. Once privately and once publicly."
 */
const SEAT_7: readonly RuleSwitch[] = [
	{
		id: 'terrifying-whisper',
		label: () => 'modes.switch.terrifyingWhisper',
		default: false,
		apply: (rule, on) => {
			const seats = rule.setup.seats;
			if (!on || seats?.kind !== 'storyteller-seat') return rule;
			return {
				...rule,
				setup: {
					...rule.setup,
					seats: { ...seats, speaks: 'private-and-public', instructions: SEAT_7_WHISPER }
				}
			};
		}
	},
	{
		// "Once per day, if the seat still has a vote, the storyteller may choose one nomination
		// and a vote to it's total." "This must be done before another nomination is made."
		id: 'seats-rise-up',
		label: () => 'modes.switch.seatsRiseUp',
		default: false,
		apply: (rule, on) => {
			const seats = rule.setup.seats;
			if (!on || seats?.kind !== 'storyteller-seat') return rule;
			const voting = {
				...rule,
				setup: { ...rule.setup, seats: { ...seats, votes: 'once-per-day' as const } }
			};
			return withInstruction(voting, SEAT_7_RISE_UP);
		}
	},
	{
		// "If a new player sits in seat 7 during the game the storyteller can choose to let them
		// stay and speak for the seat." "However they are not told the role nor any of it's prior
		// information." The app never sends a seat no one plays its character (seatRoles).
		id: 'amnesiac-at-home',
		label: () => 'modes.switch.amnesiacAtHome',
		default: false,
		apply: (rule, on) => (on ? withInstruction(rule, SEAT_7_AT_HOME) : rule)
	}
];

export const RULE_SWITCHES: Readonly<Record<string, readonly RuleSwitch[]>> = {
	'seat-7': SEAT_7,
	'plus-one': EXTRAS,
	'infinite-possibilities': EXTRAS,
	'djinns-bargain': DJINN,
	'duplicate-characters': DUPLICATES
};

/** Whether a rule's switch is on. */
export function switchOn(choices: SwitchChoices, ruleId: string, sw: RuleSwitch): boolean {
	return choices[`${ruleId}:${sw.id}`] ?? sw.default;
}

/** The rule as the game plays it, with its switches applied. */
export function switched(rule: SpecialRule, choices: SwitchChoices): SpecialRule {
	return (RULE_SWITCHES[rule.id] ?? []).reduce(
		(r, sw) => sw.apply(r, switchOn(choices, rule.id, sw)),
		rule
	);
}

/**
 * The switch choices a game's kept rules were made with, read back from the rules themselves
 * (a game keeps each rule as switched), so Character selection's Special rules shows them as
 * they were set. A rule whose file is gone keeps its defaults.
 */
export function choicesOf(
	rules: readonly SpecialRule[],
	find: (id: string) => SpecialRule | undefined
): SwitchChoices {
	const out: Record<string, boolean> = {};
	for (const rule of rules) {
		const base = find(rule.id);
		const switches = RULE_SWITCHES[rule.id] ?? [];
		if (!base || switches.length === 0) continue;
		// Every mix of the rule's switches, few enough to try them all (Seat 7 has three).
		for (let mask = 1; mask < 1 << switches.length; mask++) {
			const choices = Object.fromEntries(
				switches.map((sw, i) => [`${rule.id}:${sw.id}`, mask & (1 << i) ? !sw.default : sw.default])
			);
			if (JSON.stringify(switched(base, choices)) !== JSON.stringify(rule)) continue;
			for (const [key, on] of Object.entries(choices))
				if (on !== switches.find((sw) => key === `${rule.id}:${sw.id}`)?.default) out[key] = on;
			break;
		}
	}
	return out;
}
