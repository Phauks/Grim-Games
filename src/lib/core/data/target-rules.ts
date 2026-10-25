/**
 * Where each reminder token may go (Trevor, 2026-10-16: show valid targets for every token,
 * e.g. the Vigormortis's "Has Ability" only on a Minion it killed): the `reminderTargets`
 * part of a character's rules block, one rule per reminder label. Official characters' rules
 * were read from each character's wiki page (its How to Run section and ability) and
 * paraphrased: `note` is our own summary, never wiki prose. `ambiguous` records what the wiki
 * leaves open, for Trevor to decide.
 *
 * A rule constrains the seat the token goes on, at the moment it is placed:
 * - `seat`: `self` only the character's own seat, `other` never it, `any` either. A token
 *   with nowhere else to go sits on its own character (Trevor, 2026-10-23: "all tokens go on
 *   character, if you cant figure, just say self");
 * - `types` / `characters`: the target's true character type, or true character;
 * - `shown`: the type of the character token the target was dealt, which may not be their
 *   true character (the Drunk is dealt a Townsfolk);
 * - `alignment`: `good`/`evil`, or `same`/`opposite` to the character's player;
 * - `alignmentCounts`: at most this many copies of the token on players of each alignment
 *   (the Noble's three: two good, one evil);
 * - `life`: whether the target is alive or dead when the token goes down;
 * - `neighbour`: the nearest seat each way from the character's own seat (`of: 'self'`)
 *   or from the seat carrying another of its tokens (`of: <label>`), or from a seat whose
 *   true character type is, or may register as, `ofType` (the Marionette sits next to the
 *   Demon, or a Recluse registering as it). `type` and `alignment` skip seats of other types
 *   or alignments (the No Dashii's nearest Townsfolk; the Marionette's nearest good player);
 *   `alive` skips the dead; `both` fits only while both neighbours fit the rule (the Tea
 *   Lady's);
 * - `withLabel` / `notWithLabel`: must share, or must not share, a seat with another of
 *   the character's tokens (the Washerwoman's Wrong is never on her Townsfolk);
 * - `global`: the token marks the game, never a player (a Fabled's or Loric's own tokens);
 * - `differsFromLastNight`: the ability says "different to last night": `player`, never the
 *   player who carried the token at the latest dawn (the Devil's Advocate, Exorcist);
 *   `type`, never a player of that player's character type (the Balloonist);
 * - `minOwners`: the token exists only while this many seats hold the character (the
 *   Village Idiot's Drunk, with 2 or more Village Idiots);
 * - `info`: the token marks what the character's information showed. While the character
 *   is drunk or poisoned (or is really the Drunk, Lunatic or Marionette) that information
 *   can be false, so any seat fits (Trevor, 2026-10-18: a drunk Librarian can see anyone).
 *   Its `types` and `alignment` also accept what a player may register as (the Recluse as
 *   an evil Minion or Demon, the Spy as a good Townsfolk or Outsider).
 *
 * The checks only suggest and warn (`rules/reminder-targets.ts`); the Storyteller can put
 * any token anywhere.
 */
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	type Alignment,
	type CharacterId,
	type CharacterType,
	type ReminderLabel
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString,
	readStringArray,
	type Issues
} from './validate.ts';

export interface NeighbourRule {
	/** `self`, or a label of this character's tokens whose seat is the centre. */
	of: 'self' | (string & {});
	/** Centre on seats whose true character has, or may register as, this type instead. */
	ofType?: CharacterType;
	/** Only seats of this type count as neighbours; others are skipped. */
	type?: CharacterType;
	/** Only seats of this alignment count as neighbours; others are skipped. */
	alignment?: Alignment;
	/** Skip dead players. */
	alive?: boolean;
	/** Fits only while both neighbours fit the rule's other conditions. */
	both?: boolean;
}

export interface TargetRule {
	seat?: 'self' | 'other' | 'any';
	types?: readonly CharacterType[];
	shown?: readonly CharacterType[];
	characters?: readonly CharacterId[];
	alignment?: Alignment | 'same' | 'opposite';
	alignmentCounts?: Readonly<Partial<Record<Alignment, number>>>;
	life?: 'alive' | 'dead';
	neighbour?: NeighbourRule;
	withLabel?: string;
	notWithLabel?: string;
	global?: boolean;
	minOwners?: number;
	differsFromLastNight?: 'player' | 'type';
	info?: boolean;
	note?: string;
	ambiguous?: string;
}

const SEATS = ['self', 'other', 'any'] as const;
const RULE_ALIGNMENTS = [...ALIGNMENTS, 'same', 'opposite'] as const;
const LIFE = ['alive', 'dead'] as const;
const DIFFERS = ['player', 'type'] as const;
const TARGET_KEYS = [
	'seat',
	'types',
	'shown',
	'characters',
	'alignment',
	'alignmentCounts',
	'life',
	'neighbour',
	'withLabel',
	'notWithLabel',
	'global',
	'minOwners',
	'differsFromLastNight',
	'info',
	'note',
	'ambiguous'
] as const satisfies readonly (keyof TargetRule)[];

function readTypes(
	raw: Record<string, unknown>,
	key: string,
	path: string,
	issues: Issues
): CharacterType[] | undefined {
	const list = readStringArray(raw, key, path, issues);
	if (!list) return undefined;
	const bad = list.filter((t) => !(CHARACTER_TYPES as readonly string[]).includes(t));
	for (const t of bad) issues.add(`${path}.${key}`, `unknown type ${JSON.stringify(t)}`);
	return bad.length > 0 ? undefined : (list as CharacterType[]);
}

function readNeighbour(raw: unknown, path: string, issues: Issues): NeighbourRule | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['of', 'ofType', 'type', 'alignment', 'alive', 'both'], path, issues);
	const of = readString(raw, 'of', path, issues, true);
	if (of === undefined) return undefined;
	const out: NeighbourRule = { of };
	const ofType = readEnum(raw, 'ofType', CHARACTER_TYPES, path, issues, false);
	if (ofType) out.ofType = ofType;
	const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, false);
	if (type) out.type = type;
	const alignment = readEnum(raw, 'alignment', ALIGNMENTS, path, issues, false);
	if (alignment) out.alignment = alignment;
	const alive = readBoolean(raw, 'alive', path, issues);
	if (alive !== undefined) out.alive = alive;
	const both = readBoolean(raw, 'both', path, issues);
	if (both !== undefined) out.both = both;
	return out;
}

function readTarget(raw: unknown, path: string, issues: Issues): TargetRule | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, TARGET_KEYS, path, issues);
	const out: TargetRule = {};
	const seat = readEnum(raw, 'seat', SEATS, path, issues, false);
	if (seat) out.seat = seat;
	const types = readTypes(raw, 'types', path, issues);
	if (types) out.types = types;
	const shown = readTypes(raw, 'shown', path, issues);
	if (shown) out.shown = shown;
	const characters = readStringArray(raw, 'characters', path, issues);
	if (characters) out.characters = characters;
	const alignment = readEnum(raw, 'alignment', RULE_ALIGNMENTS, path, issues, false);
	if (alignment) out.alignment = alignment;
	if (raw.alignmentCounts !== undefined) {
		const at = `${path}.alignmentCounts`;
		if (!isObject(raw.alignmentCounts)) {
			issues.add(at, `expected object, got ${describe(raw.alignmentCounts)}`);
		} else {
			checkKeys(raw.alignmentCounts, ALIGNMENTS, at, issues);
			const counts: Partial<Record<Alignment, number>> = {};
			for (const a of ALIGNMENTS) {
				const n = readNumber(raw.alignmentCounts, a, at, issues);
				if (n !== undefined) counts[a] = n;
			}
			out.alignmentCounts = counts;
		}
	}
	const life = readEnum(raw, 'life', LIFE, path, issues, false);
	if (life) out.life = life;
	const differs = readEnum(raw, 'differsFromLastNight', DIFFERS, path, issues, false);
	if (differs) out.differsFromLastNight = differs;
	if (raw.neighbour !== undefined) {
		const neighbour = readNeighbour(raw.neighbour, `${path}.neighbour`, issues);
		if (neighbour) out.neighbour = neighbour;
	}
	for (const key of ['withLabel', 'notWithLabel', 'note', 'ambiguous'] as const) {
		const value = readString(raw, key, path, issues, false);
		if (value !== undefined) out[key] = value;
	}
	for (const key of ['global', 'info'] as const) {
		const value = readBoolean(raw, key, path, issues);
		if (value !== undefined) out[key] = value;
	}
	const minOwners = readNumber(raw, 'minOwners', path, issues);
	if (minOwners !== undefined) out.minOwners = minOwners;
	return out;
}

/**
 * Reads `reminderTargets`: one rule per reminder label. With `reminders` given (a custom
 * character's own), a rule for a label the character lacks is an error.
 */
export function readReminderTargets(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders: readonly ReminderLabel[] | undefined
): Record<ReminderLabel, TargetRule> | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const own = reminders && new Set(reminders.map((r) => r.toLowerCase()));
	const out: Record<ReminderLabel, TargetRule> = {};
	for (const [label, value] of Object.entries(raw)) {
		if (own && !own.has(label.toLowerCase())) {
			issues.add(`${path}.${label}`, 'not one of this character’s reminders');
			continue;
		}
		const rule = readTarget(value, `${path}.${label}`, issues);
		if (rule) out[label] = rule;
	}
	return out;
}
