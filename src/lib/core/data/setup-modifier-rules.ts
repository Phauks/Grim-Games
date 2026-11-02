/**
 * How a character's [bracketed] ability changes which characters are dealt: the
 * `setupModifier` part of its rules block, read here and used by `rules/setup-modifiers.ts`.
 * Brackets only matter during setup (https://wiki.bloodontheclocktower.com/Abilities).
 *
 * `summary` and `notes` are our own words, never wiki prose.
 */
import {
	ALIGNMENTS,
	SEATED_TYPES,
	type Alignment,
	type CharacterId,
	type SeatedType
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readEnum,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

/**
 * One change to the count of a character type:
 * - `delta`: add one of these values ("+0 or +1" is `[0, 1]`);
 * - `set`: the count becomes one of these values ("[No Demon]" is `[0]`), or `most` (Legion);
 * - `any`: the Storyteller picks freely ("-? to +? Outsiders").
 */
export type CountOp =
	| { kind: 'delta'; type: SeatedType; values: readonly number[] }
	| { kind: 'set'; type: SeatedType; values: readonly number[] | 'most' }
	| { kind: 'any'; type: SeatedType };

const COUNT_OP_KINDS = ['delta', 'set', 'any'] as const;

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
	/** Extra Storyteller notes for setup (bag contents, seating). */
	notes?: readonly string[];
	/**
	 * The character's own [bracketed] text also changes setup, read as a homebrew character's
	 * is (the Bootlegger carries the script's rules, such as "[+1 Demon]").
	 */
	readsBrackets?: true;
}

function readOp(raw: unknown, path: string, issues: Issues): CountOp | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const kind = readEnum(raw, 'kind', COUNT_OP_KINDS, path, issues, true);
	const type = readEnum(raw, 'type', SEATED_TYPES, path, issues, true);
	checkKeys(raw, kind === 'any' ? ['kind', 'type'] : ['kind', 'type', 'values'], path, issues);
	if (!kind || !type) return undefined;
	if (kind === 'any') return { kind, type };
	if (kind === 'set' && raw.values === 'most') return { kind, type, values: 'most' };
	const values = raw.values;
	if (!Array.isArray(values) || values.length === 0 || !values.every(Number.isInteger)) {
		issues.add(`${path}.values`, 'expected a list of whole numbers');
		return undefined;
	}
	return { kind, type, values: values as number[] };
}

function readAlignmentOp(raw: unknown, path: string, issues: Issues): AlignmentOp | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['type', 'alignment', 'count'], path, issues);
	const type = readEnum(raw, 'type', SEATED_TYPES, path, issues, true);
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, true);
	const count = raw.count;
	if (!Number.isInteger(count) || (count as number) < 1) {
		issues.add(`${path}.count`, 'expected a whole number of at least 1');
		return undefined;
	}
	if (!type || !alignment) return undefined;
	return { type, alignment, count: count as number };
}

/** Reads a `setupModifier` block. */
export function readSetupModifier(
	raw: unknown,
	path: string,
	issues: Issues
): SetupModifierRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(
		raw,
		['summary', 'ops', 'requires', 'alignments', 'copies', 'notes', 'readsBrackets'],
		path,
		issues
	);
	const summary = readString(raw, 'summary', path, issues, true);
	const ops: CountOp[] = [];
	if (raw.ops !== undefined) {
		if (!Array.isArray(raw.ops)) {
			issues.add(`${path}.ops`, `expected array, got ${describe(raw.ops)}`);
		} else {
			raw.ops.forEach((op, i) => {
				const read = readOp(op, `${path}.ops[${i}]`, issues);
				if (read) ops.push(read);
			});
		}
	}
	const requires = readString(raw, 'requires', path, issues, false);
	const alignments: AlignmentOp[] = [];
	if (raw.alignments !== undefined) {
		if (!Array.isArray(raw.alignments)) {
			issues.add(`${path}.alignments`, `expected array, got ${describe(raw.alignments)}`);
		} else {
			raw.alignments.forEach((op, i) => {
				const read = readAlignmentOp(op, `${path}.alignments[${i}]`, issues);
				if (read) alignments.push(read);
			});
		}
	}
	let copies: number[] | undefined;
	if (raw.copies !== undefined) {
		const v = raw.copies;
		if (!Array.isArray(v) || v.length === 0 || !v.every((n) => Number.isInteger(n) && n >= 0))
			issues.add(`${path}.copies`, 'expected a list of whole numbers of at least 0');
		else copies = v as number[];
	}
	const notes = readStringArray(raw, 'notes', path, issues);
	if (raw.readsBrackets !== undefined && raw.readsBrackets !== true) {
		issues.add(`${path}.readsBrackets`, 'expected true');
	}
	if (summary === undefined) return undefined;
	return {
		summary,
		ops,
		...(requires ? { requires } : {}),
		...(alignments.length > 0 ? { alignments } : {}),
		...(copies ? { copies } : {}),
		...(notes ? { notes } : {}),
		...(raw.readsBrackets === true ? { readsBrackets: true as const } : {})
	};
}
