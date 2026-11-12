import {
	anyOf,
	COUNT,
	list,
	NUMS,
	obj,
	oneOf,
	opt,
	STR,
	STRS,
	T,
	variants
} from '../field-spec.ts';
import {
	ALIGNMENTS,
	SEATED_TYPES,
	type Alignment,
	type CharacterId,
	type SeatedType
} from '../types.ts';
import { specPart } from './part.ts';

/**
 * One change to the count of a character type:
 * - `delta`: add one of these values ("+0 or +1" is `[0, 1]`); `also` lists counts allowed as
 *   well, whatever the usual count (the Lord of Typhon's `[0]`: no Minions are dealt, and the
 *   usual number plus one are made on the first night or seated by the Storyteller); `minUsual`
 *   applies it only when the usual count of its type is at least that (the Marionette's
 *   "if there are three Minions", https://wiki.bloodontheclocktower.com/Marionette);
 * - `set`: the count becomes one of these values ("[No Demon]" is `[0]`), or `most` (Legion);
 * - `any`: the Storyteller picks freely ("-? to +? Outsiders").
 */
export type CountOp =
	| {
			kind: 'delta';
			type: SeatedType;
			values: readonly number[];
			also?: readonly number[];
			minUsual?: number;
	  }
	| { kind: 'set'; type: SeatedType; values: readonly number[] | 'most' }
	| { kind: 'any'; type: SeatedType };

/**
 * Players of a type who start with the other alignment ("[1 Townsfolk is evil]", the Bounty
 * Hunter's, https://wiki.bloodontheclocktower.com/Bounty_Hunter): the Storyteller picks them
 * after the draw, and each is told on the first night (players know their own alignment,
 * https://wiki.bloodontheclocktower.com/Glossary). Counts are unchanged.
 */
export interface AlignmentOp {
	type: SeatedType;
	alignment: Alignment;
	count: number;
}

export interface SetupModifierRules {
	/** Short summary in our words: "+2 Outsiders". Shown as "Baron: +2 Outsiders". */
	summary: string;
	ops: readonly CountOp[];
	/**
	 * Another character that must be in play because of this one ("+the Damsel"). If it is not
	 * already in play it replaces a Townsfolk, so the setup analysis allows one more of its type.
	 */
	requires?: CharacterId;
	/** Players who start with the other alignment ("[1 Townsfolk is evil]"). */
	alignments?: readonly AlignmentOp[];
	/**
	 * Extra copies of this same character that may be dealt ("+0 to +2 Village Idiots" is
	 * `[0, 1, 2]`): more than the largest warns.
	 */
	copies?: readonly number[];
	/**
	 * Which characters may repeat while this one is in play, in place of TPI's
	 * `good-duplicate`/`evil-duplicate` data: `good` (Townsfolk and Outsiders), `evil` (Minions
	 * and Demons) or both. The Pope's says only good ones (https://wiki.bloodontheclocktower.com/Pope),
	 * though TPI's data gives it both.
	 */
	duplicates?: readonly Alignment[];
	/** Extra Storyteller notes for setup (bag contents, seating). */
	notes?: readonly string[];
	/**
	 * The character's own [bracketed] text also changes setup, read as a homebrew character's
	 * is (the Bootlegger carries the script's rules, such as "[+1 Demon]").
	 */
	readsBrackets?: true;
}

/** The settings each kind of change takes besides its type. */
const TAKES = { any: [], set: ['values'], delta: ['values', 'also', 'minUsual'] } as const;

/**
 * How a character's [bracketed] ability changes which characters are dealt: the
 * `setupModifier` part of its rules block, read here and used by `rules/setup/setup-modifiers.ts`.
 * Brackets only matter during setup (https://wiki.bloodontheclocktower.com/Abilities).
 *
 * `summary` and `notes` are our own words, never wiki prose.
 */
export const setupModifier = specPart(
	'setup',
	'Setup change',
	'How its bracketed text changes which characters are dealt.',
	obj({
		summary: STR,
		ops: list(
			obj({
				kind: oneOf(['delta', 'set', 'any']),
				type: oneOf(SEATED_TYPES),
				values: opt(
					variants(
						{ label: 'Numbers', is: 'array', spec: NUMS },
						{ label: 'Most', is: 'string', spec: oneOf(['most']) }
					)
				),
				also: opt(NUMS),
				minUsual: opt(COUNT)
			})
		),
		requires: opt(STR),
		alignments: opt(
			list(obj({ type: oneOf(SEATED_TYPES), alignment: oneOf(ALIGNMENTS), count: COUNT }))
		),
		copies: opt(NUMS),
		duplicates: opt(anyOf(ALIGNMENTS)),
		notes: opt(STRS),
		readsBrackets: opt(T)
	}),
	(value, path, issues): SetupModifierRules | undefined => {
		const before = issues.list.length;
		// Each kind of change takes only its own settings.
		const ops = value.ops.map((op, i): CountOp => {
			const at = `${path}.ops[${i}]`;
			const allowed: readonly string[] = TAKES[op.kind];
			for (const key of ['values', 'also', 'minUsual'] as const) {
				if (op[key] !== undefined && !allowed.includes(key))
					issues.add(`${at}.${key}`, 'unknown field');
			}
			const { kind, type, values, also, minUsual } = op;
			if (kind === 'any') return { kind, type };
			if (kind === 'set' && values === 'most') return { kind, type, values };
			if (!Array.isArray(values) || !values.length) {
				issues.add(`${at}.values`, 'expected a list of whole numbers');
				return { kind: 'any', type };
			}
			if (kind === 'set') return { kind, type, values };
			if (also && (!also.length || also.some((n) => n < 0))) {
				issues.add(`${at}.also`, 'expected a list of whole numbers, 0 or more');
			}
			return {
				kind,
				type,
				values,
				...(also ? { also } : {}),
				...(minUsual !== undefined ? { minUsual } : {})
			};
		});
		const { copies } = value;
		if (copies && (!copies.length || copies.some((n) => n < 0))) {
			issues.add(`${path}.copies`, 'expected a list of whole numbers of at least 0');
		}
		if (issues.list.length > before) return undefined;
		return {
			...value,
			ops,
			...(value.requires ? { requires: value.requires as CharacterId } : {})
		};
	}
);
