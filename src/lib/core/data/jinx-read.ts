/**
 * The jinx verbs (refactor review B1): each verb's settings are one field spec, which is also
 * the Character builder's field for it and the shape its reader checks (`readSpec`), the same
 * pattern as a rules part (`parts/part.ts`). A verb whose settings must agree, or that has a
 * default, says so in its `refine`, which returns the effect's own type (`jinx-rules.ts`), so
 * the reader is typed by the format. Each effect's `who` and `when` are read here too
 * (`jinx-conditions.ts`), and the prerequisites on this character's side (`JINX_NEEDS`).
 */
import {
	anyOf,
	byCharacter,
	COUNT,
	list,
	obj,
	oneOf,
	opt,
	someOf,
	STR,
	T,
	TEXT,
	variants,
	type FieldSpec,
	type Spec,
	type SpecValue,
	type Variant
} from './field-spec.ts';
import {
	ABNORMAL_COUNTS,
	CHOOSES_VIA,
	GAINED_ENDS,
	GIVEN_INSTEAD,
	GIVEN_WHERE,
	NOT_SHOWN,
	IMPAIR_KINDS,
	JINX_END_EVENTS,
	JINX_END_KINDS,
	JINX_END_SUBJECTS,
	presetJinxEnd,
	type JinxEnd,
	type JinxEndKind,
	JINX_WHO,
	LEARNS,
	NIGHT_CHOICE_CHOOSES,
	NIGHT_CHOICE_PARTNER,
	NO_EXECUTE_NOW_PLAYER,
	NO_KILL_TRIGGERS,
	STORYTELLER_CHOOSES,
	STORYTELLER_HAS,
	GRIMOIRE_HIDDEN,
	type JinxCondition,
	type JinxEffect,
	type JinxRuleKey,
	type JinxRules
} from './jinx-rules.ts';
import { parseCharacterRules } from './character-rules.ts';
import { CONDITION_FIELD, readCondition } from './jinx-conditions.ts';
import { PROTECTS_FROM } from './parts/protects.ts';
import { readSpec } from './read-spec.ts';
import { jinxNeedsOn } from './jinx-needs.ts';
import {
	ALIGNMENTS,
	CHARACTER_TYPES,
	SEATED_TYPES,
	type CharacterId,
	type ReminderLabel
} from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	type Issues,
	type Json
} from './validate.ts';

/** One of the partner's reminders, by its label: not one of this character's own. */
const LABEL = STR as Spec<ReminderLabel>;

type VerbKey = Exclude<JinxRuleKey, 'exclusive'>;
/** A verb's own settings, as its effect type has them. */
type Params<K extends VerbKey> = Omit<NonNullable<JinxRules[K]>, 'who' | 'when'>;

/** How one verb is written and read. */
interface Verb<R> {
	/** Its own settings, an object spec: the builder's field and what the reader checks. */
	spec: Extract<FieldSpec, { kind: 'object' }>;
	/** The setting it may be written as alone, `"noKill": "token"` for `{"on": "token"}`. */
	main?: string;
	/** `both` is allowed as `who`. */
	both?: true;
	/** Its settings read, with `raw` (the whole effect, `who` and `when` too) for a check. */
	read: (raw: Json, path: string, issues: Issues) => R | undefined;
}

/**
 * A verb whose settings are `spec`. `refine` adds what the spec can't say, recording problems
 * in `issues` (undefined when unusable), and may narrow the type. `raw` is the effect as
 * written, for a check about its `who` or `when`.
 */
function verb<S extends Spec<object>, R = SpecValue<S>>(
	spec: S,
	opts: {
		main?: string;
		both?: true;
		refine?: (value: SpecValue<S>, path: string, issues: Issues, raw: Json) => R | undefined;
	} = {}
): Verb<R> {
	const { main, both, refine } = opts;
	return {
		spec: spec as Extract<FieldSpec, { kind: 'object' }>,
		...(main ? { main } : {}),
		...(both ? { both } : {}),
		read: (raw, path, issues) => {
			const own = Object.fromEntries(
				Object.entries(raw).filter(([key]) => key !== 'who' && key !== 'when')
			);
			const value = readSpec(spec, own, path, issues, undefined);
			if (value === undefined) return undefined;
			return refine ? refine(value, path, issues, raw) : (value as R);
		}
	};
}

/** A verb with nothing to say but `who` and `when`. */
const plain = () => verb(obj({}));

/** A verb whose one setting, `key`, is one of `values` and may be written alone. */
const choice = <const K extends string, const V extends string>(key: K, values: readonly V[]) =>
	verb(obj({ [key]: oneOf(values) } as { [P in K]: Spec<V> }), { main: key });

/** Which players also become one of the type, in `turnsPlayersInto`'s words. */
const ALSO_BECOMES = ['drafter', 'neighbours'] as const;

/** The settings each official end kind takes beside `kind` and `winner`. */
const END_TAKES: Record<Exclude<JinxEndKind, 'condition'>, readonly (keyof JinxEnd)[]> = {
	'nominated-marked-executed': ['token'],
	'marked-executed': ['token'],
	'day-without-execution': ['day'],
	'ability-stopped': ['alive'],
	'gained-end': ['end'],
	'night-instead': ['chooser'],
	executed: ['player']
};
/** The settings a `condition` end takes beside `kind`, `event` and `winner`. */
const CONDITION_TAKES: readonly (keyof JinxEnd)[] = [
	'subject',
	'token',
	'nominatedBySelf',
	'died',
	'noExecution',
	'bothAlive',
	'stops',
	'day',
	'alive'
];
/** The `condition` settings only one event takes. */
const ONLY_WITH: Partial<Record<keyof JinxEnd, (typeof JINX_END_EVENTS)[number]>> = {
	nominatedBySelf: 'executed',
	died: 'executed',
	noExecution: 'day-ends',
	bothAlive: 'day-ends',
	day: 'day-ends',
	stops: 'ability-used',
	alive: 'ability-used'
};

/**
 * An `endsGame`: an official kind with the settings it takes (each read into the `condition`
 * it is a preset of, `presetJinxEnd`), or a `condition` whose settings fit its event.
 */
function refineEnd(end: JinxEnd, path: string, issues: Issues, raw: Json): JinxEnd | undefined {
	const before = issues.list.length;
	const { kind } = end;
	const set = (Object.keys(end) as (keyof JinxEnd)[]).filter((k) => k !== 'kind');
	const unknown = (takes: readonly (keyof JinxEnd)[]) => {
		for (const key of set) if (!takes.includes(key)) issues.add(`${path}.${key}`, 'unknown field');
	};
	if (kind === 'condition') {
		unknown(['event', 'winner', ...CONDITION_TAKES]);
		if (!end.event) issues.add(`${path}.event`, 'missing');
		if (!end.winner) issues.add(`${path}.winner`, 'missing');
		if (end.event) {
			for (const [key, event] of Object.entries(ONLY_WITH))
				if (end[key as keyof JinxEnd] !== undefined && end.event !== event)
					issues.add(`${path}.${key}`, `only with event \`${event}\``);
			if (end.event !== 'day-ends' && !end.subject) issues.add(`${path}.subject`, 'missing');
		}
		if (end.subject === 'marked' && end.token === undefined) issues.add(`${path}.token`, 'missing');
		if (end.token !== undefined && end.subject !== 'marked')
			issues.add(`${path}.token`, 'only with subject `marked`');
		return issues.list.length > before ? undefined : end;
	}
	const takes = END_TAKES[kind];
	const winnerless = kind === 'night-instead';
	unknown([...(winnerless ? [] : (['winner'] as const)), ...takes]);
	if (!winnerless && !end.winner) issues.add(`${path}.winner`, 'missing');
	if (kind === 'marked-executed' && end.token === undefined) issues.add(`${path}.token`, 'missing');
	if (kind === 'gained-end' && !end.end) issues.add(`${path}.end`, 'missing');
	// On the final day (`when` has `final-day`), `day` may be left out: the latest day that ended.
	const finalDay = Array.isArray(raw.when) && raw.when.includes('final-day');
	if (kind === 'day-without-execution' && end.day === undefined && !finalDay)
		issues.add(`${path}.day`, 'missing');
	if (kind === 'ability-stopped' && end.alive === undefined) issues.add(`${path}.alive`, 'missing');
	return issues.list.length > before ? undefined : presetJinxEnd(end);
}

/** `parts`, each read by its own part reader; never jinxes or an optional rule. */
function refinePatch(
	value: { parts: unknown },
	path: string,
	issues: Issues
): Params<'patch'> | undefined {
	const at = `${path}.parts`;
	if (!isObject(value.parts) || Object.keys(value.parts).length === 0) {
		issues.add(at, `expected an object of parts, got ${describe(value.parts)}`);
		return undefined;
	}
	for (const key of ['jinxes', 'optionalRule'])
		if (value.parts[key] !== undefined) issues.add(`${at}.${key}`, 'not in a patch');
	const parts = parseCharacterRules(value.parts, at, issues);
	return parts ? { parts } : undefined;
}

/** Every verb, by its key. */
const VERBS: { readonly [K in VerbKey]: Verb<Params<K>> } = {
	cannotCreate: choice('via', ['givesAbility', 'changesCharacter']),
	cannotChoose: plain(),
	givenInstead: verb(
		obj({
			instead: oneOf(GIVEN_INSTEAD),
			type: opt(oneOf(CHARACTER_TYPES)),
			upTo: opt(COUNT),
			where: opt(oneOf(GIVEN_WHERE))
		}),
		{
			main: 'instead',
			refine: (value, path, issues) => {
				const { instead, type, upTo, where } = value;
				if (instead === 'a-minion' && (type || where || upTo !== undefined)) {
					issues.add(path, '`type`, `upTo` and `where` only with `instead: "becomes"`');
					return undefined;
				}
				if (upTo !== undefined && !type) {
					issues.add(`${path}.upTo`, 'only with `type`');
					return undefined;
				}
				return value;
			}
		}
	),
	noTurnGood: plain(),
	spareToken: plain(),
	storytellerChooses: verb(
		obj({
			what: oneOf(STORYTELLER_CHOOSES),
			via: opt(oneOf(CHOOSES_VIA)),
			creating: opt(oneOf(['partner']))
		}),
		{
			main: 'what',
			refine: (value, path, issues) => {
				const { what, via, creating } = value;
				if (via && what !== 'player') {
					issues.add(`${path}.via`, 'only with `what: "player"`');
					return undefined;
				}
				if (creating && (what !== 'player' || (via ?? 'changesCharacter') !== 'changesCharacter')) {
					issues.add(`${path}.creating`, 'only with `what: "player"` by `changesCharacter`');
					return undefined;
				}
				return value;
			}
		}
	),
	wakes: choice('how', ['one-by-one']),
	// The Lord of Typhon's `turnsPlayersInto` words (P12): `drafter`, the default, is the player
	// made the partner; `neighbours` makes both their neighbours of `type`.
	alsoBecomes: verb(obj({ type: oneOf(SEATED_TYPES), players: opt(oneOf(ALSO_BECOMES)) }), {
		main: 'type',
		refine: ({ type, players }) => (players === 'neighbours' ? { type, players } : { type })
	}),
	carriedBy: verb(obj({ type: opt(oneOf(CHARACTER_TYPES)), marked: opt(LABEL) }), {
		refine: (value, path, issues) => {
			if ((value.type === undefined) === (value.marked === undefined)) {
				issues.add(path, 'needs type or marked, not both');
				return undefined;
			}
			return value;
		}
	}),
	diesWhenExecuted: plain(),
	registersTo: verb(
		obj({
			alignments: opt(anyOf(ALIGNMENTS)),
			types: opt(anyOf(CHARACTER_TYPES)),
			always: opt(T)
		}),
		{
			refine: (value, path, issues) => {
				if (!value.alignments?.length && !value.types?.length) {
					issues.add(path, 'needs alignments or types');
					return undefined;
				}
				return value;
			}
		}
	),
	impairs: verb(obj({ kind: oneOf(IMPAIR_KINDS), unlessImpaired: opt(T) }), {
		main: 'kind',
		both: true,
		refine: (value, path, issues, raw) => {
			// One about one player alone is a `patch` of the part `impairs`.
			const gained = Array.isArray(raw.when) && raw.when.includes('has-partner-ability');
			if (raw.who !== 'both' && !value.unlessImpaired && !gained) {
				issues.add(path, 'about one player alone: write a `patch` of the part `impairs`');
				return undefined;
			}
			return value;
		}
	}),
	noKill: verb(
		obj({
			on: opt(oneOf(NO_KILL_TRIGGERS)),
			killer: opt(oneOf(['demon'])),
			token: opt(LABEL)
		}),
		{
			main: 'on',
			refine: (value, path, issues, raw) => {
				const { on, killer, token } = value;
				if (killer === undefined && on === undefined) {
					issues.add(`${path}.on`, 'missing');
					return undefined;
				}
				if (killer && on) {
					issues.add(path, 'needs `on` or `killer`, not both');
					return undefined;
				}
				if (killer && !(Array.isArray(raw.when) && raw.when.length > 0)) {
					issues.add(`${path}.when`, 'required with `killer`');
					return undefined;
				}
				if (token !== undefined && on !== 'chosen') {
					issues.add(`${path}.token`, 'only with `on: "chosen"`');
					return undefined;
				}
				return value;
			}
		}
	),
	protects: verb(
		obj({ from: opt(oneOf(PROTECTS_FROM)), night: opt(T), by: opt(oneOf(['partner'])) }),
		{ main: 'from', refine: (value) => ({ ...value, from: value.from ?? 'any' }) }
	),
	grimoire: verb(
		obj({
			hides: variants(
				{ label: 'All', is: 'string', spec: oneOf(['all']) },
				{ label: 'Some', is: 'array', spec: anyOf(GRIMOIRE_HIDDEN) }
			)
		}),
		{
			main: 'hides',
			refine: (value, path, issues) => {
				if (value.hides.length === 0) {
					issues.add(`${path}.hides`, 'empty');
					return undefined;
				}
				return value;
			}
		}
	),
	endsGame: verb(
		obj({
			kind: oneOf(JINX_END_KINDS),
			winner: opt(oneOf(ALIGNMENTS)),
			end: opt(oneOf(GAINED_ENDS)),
			chooser: opt(oneOf(JINX_WHO)),
			token: opt(LABEL),
			day: opt(COUNT),
			alive: opt(COUNT),
			player: opt(oneOf(JINX_WHO)),
			event: opt(oneOf(JINX_END_EVENTS)),
			subject: opt(oneOf(JINX_END_SUBJECTS)),
			nominatedBySelf: opt(T),
			died: opt(T),
			noExecution: opt(T),
			bothAlive: opt(T),
			stops: opt(T)
		}),
		{ refine: refineEnd }
	),
	nightChoice: verb(
		obj({ chooses: oneOf(NIGHT_CHOICE_CHOOSES), partner: oneOf(NIGHT_CHOICE_PARTNER) })
	),
	partnerSetup: plain(),
	partnerInPlay: plain(),
	learns: choice('what', LEARNS),
	trueInfo: plain(),
	notDeclared: plain(),
	keepsProtection: plain(),
	noExecuteNow: verb(obj({ player: oneOf(NO_EXECUTE_NOW_PLAYER), token: opt(LABEL) }), {
		main: 'player',
		refine: (value, path, issues) => {
			if (value.player !== 'marked') return { player: value.player };
			if (value.token === undefined) {
				issues.add(`${path}.token`, 'missing');
				return undefined;
			}
			return value;
		}
	}),
	allEvilBecome: plain(),
	partnerKeepsAbility: plain(),
	storytellerHas: choice('once', STORYTELLER_HAS),
	arbitraryDeaths: plain(),
	changesCharacter: verb(obj({ token: LABEL }), { main: 'token' }),
	guessesPartner: plain(),
	notShown: choice('what', NOT_SHOWN),
	notSecondDemon: plain(),
	keepsAbility: verb(obj({ afterDeath: T })),
	survives: choice('on', ['carrier-executed']),
	killsMarked: verb(obj({ token: LABEL }), { main: 'token' }),
	thinksPartnerSetup: plain(),
	voter: verb(obj({ countsOnlyWith: T })),
	abnormalCounts: choice('counts', ABNORMAL_COUNTS),
	// Parts of the character's own rules in place of its own while the jinx holds: any part,
	// so written as rules text.
	patch: verb(obj({ parts: TEXT }), { refine: refinePatch })
};

/**
 * A verb's builder field: written in full, its own settings with `who` and `when`; written
 * short, `true` (a verb with no main setting) or its main setting's value alone.
 */
function verbField(v: Verb<unknown>): FieldSpec {
	const who = oneOf(v.both ? [...JINX_WHO, 'both'] : JINX_WHO);
	const full: FieldSpec = {
		kind: 'object',
		fields: [
			...v.spec.fields,
			{ key: 'who', spec: who, optional: true },
			{ key: 'when', spec: list(CONDITION_FIELD), optional: true }
		]
	};
	const main = v.main ? v.spec.fields.find((f) => f.key === v.main)?.spec : undefined;
	const mainSpec = main?.kind === 'variants' ? main.variants[0].spec : main;
	const short: Variant = mainSpec
		? { label: 'Short', is: mainSpec.kind === 'count' ? 'number' : 'string', spec: mainSpec }
		: { label: 'On', is: 'true', spec: T };
	return variants(short, { label: 'With who and when', is: 'object', spec: full });
}

/**
 * The Character builder's fields for a character's jinxes (M79): one entry per jinxed partner,
 * each with the effects the jinx has, from the verbs above. Each effect may be written the
 * short way or in full, so an official file's jinxes open in fields as they are written
 * (`parts/part-fields.test.ts` reads every official jinx through these).
 */
export const JINX_FIELDS: FieldSpec = byCharacter(
	someOf({
		exclusive: T,
		...Object.fromEntries(
			Object.entries(VERBS).map(([key, v]) => [key, verbField(v as Verb<unknown>)])
		)
	})
);

/** Every key a jinx entry may have: `exclusive`, then each verb. */
export const JINX_RULE_KEYS: readonly JinxRuleKey[] = [
	'exclusive',
	...(Object.keys(VERBS) as Exclude<JinxRuleKey, 'exclusive'>[])
];

/** One effect, from `true`, a bare main value or an object; undefined (with an issue) if bad. */
function readEffect(
	key: Exclude<JinxRuleKey, 'exclusive'>,
	raw: unknown,
	path: string,
	issues: Issues
): JinxEffect | undefined {
	const v = VERBS[key];
	let obj: Json;
	if (raw === true && v.main === undefined) obj = {};
	else if (v.main !== undefined && (typeof raw === 'string' || typeof raw === 'number'))
		obj = { [v.main]: raw };
	else if (isObject(raw)) obj = raw;
	else {
		issues.add(
			path,
			`expected ${v.main ? 'a value or object' : 'true or object'}, got ${describe(raw)}`
		);
		return undefined;
	}
	const before = issues.list.length;
	const who = readEnum(obj, 'who', v.both ? [...JINX_WHO, 'both'] : JINX_WHO, path, issues, false);
	let when: JinxCondition[] | undefined;
	if (obj.when !== undefined) {
		if (!Array.isArray(obj.when) || obj.when.length === 0)
			issues.add(`${path}.when`, `expected a list of conditions, got ${describe(obj.when)}`);
		else when = obj.when.map((c, i) => readCondition(c, `${path}.when[${i}]`, issues)!);
	}
	const params = v.read(obj, path, issues);
	if (!params || issues.list.length > before) return undefined;
	return { ...params, ...(who ? { who } : {}), ...(when ? { when } : {}) } as JinxEffect;
}

/**
 * Reads a `jinxes` block: one entry per jinxed partner, each saying at least one thing.
 * `self`, the rules block it is in, lets an effect whose prerequisite is missing there be
 * reported (`JINX_NEEDS`).
 */
export function readJinxRules(
	raw: unknown,
	path: string,
	issues: Issues,
	self?: Json
): Readonly<Record<CharacterId, JinxRules>> | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const out: Record<CharacterId, JinxRules> = {};
	for (const [partner, entry] of Object.entries(raw)) {
		const at = `${path}.${partner}`;
		if (!isObject(entry)) {
			issues.add(at, `expected object, got ${describe(entry)}`);
			continue;
		}
		checkKeys(entry, JINX_RULE_KEYS, at, issues);
		const rules: Record<string, unknown> = {};
		if (readBoolean(entry, 'exclusive', at, issues)) rules.exclusive = true;
		for (const key of Object.keys(VERBS) as Exclude<JinxRuleKey, 'exclusive'>[]) {
			const value = entry[key];
			if (value === undefined || value === false) continue;
			const effect = readEffect(key, value, `${at}.${key}`, issues);
			if (effect) rules[key] = effect;
		}
		if (Object.keys(rules).length === 0) {
			issues.add(at, 'a jinx entry needs at least one rule');
			continue;
		}
		if (self)
			for (const { key, parts } of jinxNeedsOn(rules, 'self'))
				if (!parts.some((p) => self[p] !== undefined))
					issues.add(`${at}.${key}`, `needs ${parts.map((p) => `\`${p}\``).join(' or ')} here`);
		out[partner] = rules as JinxRules;
	}
	return Object.keys(out).length > 0 ? out : undefined;
}
