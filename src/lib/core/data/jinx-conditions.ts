/**
 * The `when` conditions of a jinx effect, and their reader. Split from the format
 * (`jinx-rules.ts`) so it stays one module per concern; `rules/jinxes/jinx-when.ts` says whether each
 * holds, and `jinx-needs.ts` (`flipCondition`) turns one round for the partner's file.
 *
 * Each condition is about the game now, or, for an effect read at an event (a game end at an
 * execution, `rules/jinxes/jinx-ends.ts`), the game at that moment. `self` is the character of the
 * file or script entry the effect is in, `partner` the jinx's other character:
 * - `self-alive`, `partner-alive`: a player of that character is alive (with a player in
 *   question, that player);
 * - `self-dead`, `partner-dead` (M44): a player of that character is dead (with a player in
 *   question, that player). Unlike `{"not": "self-alive"}`, it needs the character in play;
 * - `self-in-play`, `partner-in-play`: a player is that character, alive or dead;
 * - `self-executed`, `partner-executed` (M44): a player of that character was executed today
 *   (logged, whether or not they died; at night, the day just gone);
 * - `nominated-partner`, `nominated-by-partner` (M46): a self player nominated a partner's
 *   player today, or a partner's player nominated a self player (at night, the day just gone);
 * - `has-partner-ability`: the effect is about a self player who has the partner's ability
 *   from their token (`gainsAbilityOf`, `gainedFrom`) or holds it, not their own; it applies to
 *   that player only. Its mirror, read from the partner's file, is `partner-has-this-ability`;
 * - `after-execution`: someone was executed today;
 * - `final-day`: 3 or fewer players are alive, not counting Travellers (the usual final day;
 *   the wiki leaves the exact day to the Storyteller);
 * - `{"day": n}`: today is day n (until the next dawn); `{"night": n}`: tonight is night n,
 *   which comes before day n; `{"afterDay": n}`: day n is over (a change at night counts from
 *   the night after day n);
 * - `{"marked": label}`: the self player carries the partner's reminder `label`;
 *   `{"partnerMarked": label}`, the partner's player carries this character's;
 * - `{"alignment": a}`: the self player is alignment `a` now (`good` or `evil`);
 *   `{"partnerAlignment": a}`, a partner's player is;
 * - `{"alive": id}`, `{"inPlay": id}` (M44): a player whose character is `id`, a third character
 *   on the script, is alive, or is in play alive or dead (a Fabled or Loric in play counts). It
 *   reads the same from either file. One naming a character not on the script never holds, and
 *   the script warns at load;
 * - `{"not": condition}` (M44): the condition does not hold, for any condition above.
 * Where a reader knows only the script (a picker, the bag), a condition about the board isn't
 * checked and the effect may apply; `not` of one is unchecked too.
 *
 * A worked example, as a script writes it on its custom Lamplighter's entry:
 * `{"id": "empath", "reason": "…", "rules": {"impairs": {"who": "partner", "kind": "poisoned",
 * "when": ["self-dead"]}}}`. Read for the Empath (`rules/jinxes/jinx-pairs.ts`), the condition turns
 * round to `partner-dead`: the Empath is poisoned while the Lamplighter's player is dead.
 */
import {
	CHARACTER,
	COUNT,
	obj,
	oneOf,
	STR,
	TOKEN,
	worded,
	type FieldSpec,
	type Variant
} from './field-spec.ts';
import { ALIGNMENTS, type Alignment, type CharacterId, type ReminderLabel } from './types.ts';
import {
	describe,
	isObject,
	readEnum,
	readNumber,
	readString,
	type Issues,
	type Json
} from './validate.ts';

export const JINX_FLAGS = [
	'self-alive',
	'partner-alive',
	'self-dead',
	'partner-dead',
	'self-in-play',
	'partner-in-play',
	'self-executed',
	'partner-executed',
	'nominated-partner',
	'nominated-by-partner',
	'has-partner-ability',
	'partner-has-this-ability',
	'after-execution',
	'final-day'
] as const;
export type JinxFlag = (typeof JINX_FLAGS)[number];

/** A `when` condition: a flag, one keyed number, label, alignment or character, or a `not`. */
export type JinxCondition =
	| JinxFlag
	| { afterDay: number }
	| { day: number }
	| { night: number }
	| { marked: ReminderLabel }
	| { partnerMarked: ReminderLabel }
	| { alignment: Alignment }
	| { partnerAlignment: Alignment }
	| { alive: CharacterId }
	| { inPlay: CharacterId }
	| { not: JinxCondition };

/**
 * A `when` condition as the Character builder edits it: a plain one by name, or one keyed with
 * its value. A `not` holds another condition, so the description refers to itself.
 */
const CONDITION_VARIANTS: Variant[] = [
	{
		label: 'Condition',
		is: 'string',
		spec: worded(
			{
				label: 'Condition',
				names: {
					'self-alive': 'Its player is alive',
					'partner-alive': 'The partner’s player is alive',
					'self-dead': 'Its player is dead',
					'partner-dead': 'The partner’s player is dead',
					'self-in-play': 'It is in play',
					'partner-in-play': 'The partner is in play',
					'self-executed': 'Its player was executed today',
					'partner-executed': 'The partner’s player was executed today',
					'nominated-partner': 'Its player nominated the partner’s today',
					'nominated-by-partner': 'The partner’s player nominated its player today',
					'has-partner-ability': 'Its player has the partner’s ability',
					'partner-has-this-ability': 'The partner’s player has its ability',
					'after-execution': 'Someone was executed today',
					'final-day': 'It is the final day'
				}
			},
			oneOf(JINX_FLAGS)
		)
	},
	{
		label: 'After day',
		has: 'afterDay',
		spec: obj({ afterDay: worded({ label: 'After day' }, COUNT) })
	},
	{ label: 'Day', has: 'day', spec: obj({ day: worded({ label: 'Day' }, COUNT) }) },
	{ label: 'Night', has: 'night', spec: obj({ night: worded({ label: 'Night' }, COUNT) }) },
	// The partner's reminder on this character's player: not one of this character's own.
	{
		label: 'Marked',
		has: 'marked',
		spec: obj({ marked: worded({ label: 'Its player has the partner’s' }, STR) })
	},
	{
		label: 'Partner marked',
		has: 'partnerMarked',
		spec: obj({ partnerMarked: worded({ label: 'The partner’s player has' }, TOKEN) })
	},
	{
		label: 'Alignment',
		has: 'alignment',
		spec: obj({ alignment: worded({ label: 'Its player is' }, oneOf(ALIGNMENTS)) })
	},
	{
		label: 'Partner alignment',
		has: 'partnerAlignment',
		spec: obj({ partnerAlignment: worded({ label: 'The partner’s player is' }, oneOf(ALIGNMENTS)) })
	},
	{ label: 'Alive', has: 'alive', spec: obj({ alive: worded({ label: 'Alive' }, CHARACTER) }) },
	{
		label: 'In play',
		has: 'inPlay',
		spec: obj({ inPlay: worded({ label: 'In play' }, CHARACTER) })
	}
];
export const CONDITION_FIELD: FieldSpec = { kind: 'variants', variants: CONDITION_VARIANTS };
CONDITION_VARIANTS.push({
	label: 'Not',
	has: 'not',
	spec: obj({ not: worded({ label: 'Not' }, CONDITION_FIELD) })
});

const NUMBER_CONDITIONS = ['afterDay', 'day', 'night'] as const;
const LABEL_CONDITIONS = ['marked', 'partnerMarked', 'alive', 'inPlay'] as const;
const ALIGNMENT_CONDITIONS = ['alignment', 'partnerAlignment'] as const;

export /** A whole number of 1 or more, with an issue when it is missing or isn't one. */
function readPositive(raw: Json, key: string, path: string, issues: Issues): number | undefined {
	const value = readNumber(raw, key, path, issues);
	if (raw[key] === undefined) {
		issues.add(`${path}.${key}`, 'missing');
		return undefined;
	}
	if (value === undefined) return undefined;
	if (!Number.isInteger(value) || value < 1) {
		issues.add(`${path}.${key}`, 'expected a whole number of 1 or more');
		return undefined;
	}
	return value;
}

/** One `when` condition, or undefined (with an issue) when it is not one. */
export function readCondition(
	raw: unknown,
	path: string,
	issues: Issues
): JinxCondition | undefined {
	if (typeof raw === 'string') {
		if ((JINX_FLAGS as readonly string[]).includes(raw)) return raw as JinxFlag;
		issues.add(path, `unknown condition ${JSON.stringify(raw)}`);
		return undefined;
	}
	const keys = isObject(raw) ? Object.keys(raw) : [];
	if (!isObject(raw) || keys.length !== 1) {
		issues.add(path, `expected a condition, got ${describe(raw)}`);
		return undefined;
	}
	const [key] = keys;
	if (key === 'not') {
		const inner = readCondition(raw.not, `${path}.not`, issues);
		return inner === undefined ? undefined : { not: inner };
	}
	if ((NUMBER_CONDITIONS as readonly string[]).includes(key)) {
		const n = readPositive(raw, key, path, issues);
		return n === undefined ? undefined : ({ [key]: n } as JinxCondition);
	}
	if ((LABEL_CONDITIONS as readonly string[]).includes(key)) {
		const label = readString(raw, key, path, issues, true);
		return label === undefined ? undefined : ({ [key]: label } as JinxCondition);
	}
	if ((ALIGNMENT_CONDITIONS as readonly string[]).includes(key)) {
		const alignment = readEnum(raw, key, ALIGNMENTS, path, issues, true);
		return alignment === undefined ? undefined : ({ [key]: alignment } as JinxCondition);
	}
	issues.add(`${path}.${key}`, 'unknown condition');
	return undefined;
}

/** The third characters `conditions` name (`alive`, `inPlay`, inside a `not` too). */
export function namedCharacters(conditions: readonly JinxCondition[] | undefined): CharacterId[] {
	return (conditions ?? []).flatMap((c): CharacterId[] => {
		if (typeof c === 'string') return [];
		if ('not' in c) return namedCharacters([c.not]);
		if ('alive' in c) return [c.alive];
		if ('inPlay' in c) return [c.inPlay];
		return [];
	});
}
