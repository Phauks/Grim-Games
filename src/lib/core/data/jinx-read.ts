/**
 * Reads the `jinxes` part of a rules block, and a script jinx's `rules`, in the format
 * `jinx-rules.ts` documents: one reader per verb (`VERBS`), each effect's `who` and `when`
 * (`jinx-conditions.ts`), and the prerequisites on this character's side (`JINX_NEEDS`). Split
 * from the format so each file stays one concern.
 */
import {
	ABNORMAL_COUNTS,
	CHOOSES_VIA,
	GAINED_ENDS,
	GIVEN_INSTEAD,
	GIVEN_WHERE,
	NOT_SHOWN,
	IMPAIR_KINDS,
	JINX_END_KINDS,
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
import { readCondition, readPositive } from './jinx-conditions.ts';
import { PROTECTS_FROM } from './parts/protects.ts';
import { jinxNeedsOn } from './jinx-needs.ts';
import { ALIGNMENTS, CHARACTER_TYPES, type CharacterId } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readString,
	readStringArray,
	type Issues,
	type Json
} from './validate.ts';

/** How one verb's parameters are read: its fields, its main one (for a bare value), its reader. */
interface Verb {
	fields: readonly string[];
	main?: string;
	read: (raw: Json, path: string, issues: Issues) => Json | undefined;
	/** `both` is allowed as `who`. */
	both?: true;
}

const plain: Verb = { fields: [], read: () => ({}) };

const enumVerb = (field: string, values: readonly string[]): Verb => ({
	fields: [field],
	main: field,
	read: (raw, path, issues) => {
		const value = readEnum(raw, field, values, path, issues, true);
		return value === undefined ? undefined : { [field]: value };
	}
});

const labelVerb = (field: string): Verb => ({
	fields: [field],
	main: field,
	read: (raw, path, issues) => {
		const value = readString(raw, field, path, issues, true);
		return value === undefined ? undefined : { [field]: value };
	}
});

/** A verb whose one parameter is `true` (a patch that switches on one field of a part). */
const flagVerb = (field: string): Verb => ({
	fields: [field],
	read: (raw, path, issues) => {
		if (readBoolean(raw, field, path, issues) === true) return { [field]: true };
		issues.add(`${path}.${field}`, 'expected true');
		return undefined;
	}
});

function readGivenInstead(raw: Json, path: string, issues: Issues): Json | undefined {
	const instead = readEnum(raw, 'instead', GIVEN_INSTEAD, path, issues, true);
	if (!instead) return undefined;
	const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, false);
	const where = readEnum(raw, 'where', GIVEN_WHERE, path, issues, false);
	const upTo = raw.upTo === undefined ? undefined : readPositive(raw, 'upTo', path, issues);
	if (raw.upTo !== undefined && upTo === undefined) return undefined;
	if (instead === 'a-minion' && (type || where || upTo !== undefined)) {
		issues.add(path, '`type`, `upTo` and `where` only with `instead: "becomes"`');
		return undefined;
	}
	if (upTo !== undefined && !type) {
		issues.add(`${path}.upTo`, 'only with `type`');
		return undefined;
	}
	return {
		instead,
		...(type ? { type } : {}),
		...(upTo !== undefined ? { upTo } : {}),
		...(where ? { where } : {})
	};
}

/** A non-empty list of known values, or undefined (with an issue) when it is not one. */
function readEnumList<T extends string>(
	raw: Json,
	key: string,
	values: readonly T[],
	path: string,
	issues: Issues
): T[] | undefined {
	const list = readStringArray(raw, key, path, issues);
	if (!list) return undefined;
	const bad = list.filter((v) => !(values as readonly string[]).includes(v));
	for (const v of bad) issues.add(`${path}.${key}`, `unknown value ${JSON.stringify(v)}`);
	if (bad.length > 0) return undefined;
	if (list.length === 0) {
		issues.add(`${path}.${key}`, 'empty');
		return undefined;
	}
	return list as T[];
}

function readEnd(raw: Json, path: string, issues: Issues): Json | undefined {
	const kind = readEnum(raw, 'kind', JINX_END_KINDS, path, issues, true);
	if (!kind) return undefined;
	const extra: readonly string[] = {
		'nominated-marked-executed': ['token'],
		'marked-executed': ['token'],
		'day-without-execution': ['day'],
		'ability-stopped': ['alive'],
		'gained-end': ['end'],
		'night-instead': ['chooser'],
		executed: ['player']
	}[kind];
	const winnerless = kind === 'night-instead';
	checkKeys(
		raw,
		['kind', ...(winnerless ? [] : ['winner']), ...extra, 'who', 'when'],
		path,
		issues
	);
	const winner = winnerless ? undefined : readEnum(raw, 'winner', ALIGNMENTS, path, issues, true);
	if (!winnerless && !winner) return undefined;
	const out: Json = { kind, ...(winner ? { winner } : {}) };
	if (extra.includes('token')) {
		const token = readString(raw, 'token', path, issues, kind === 'marked-executed');
		if (token !== undefined) out.token = token;
		if (kind === 'marked-executed' && token === undefined) return undefined;
	}
	for (const key of ['player', 'chooser'] as const) {
		if (!extra.includes(key)) continue;
		const who = readEnum(raw, key, JINX_WHO, path, issues, false);
		if (who) out[key] = who;
	}
	if (extra.includes('end')) {
		const end = readEnum(raw, 'end', GAINED_ENDS, path, issues, true);
		if (!end) return undefined;
		out.end = end;
	}
	// On the final day (`when` has `final-day`), `day` may be left out: the latest day that ended.
	const finalDay = Array.isArray(raw.when) && raw.when.includes('final-day');
	for (const key of ['day', 'alive'] as const) {
		if (!extra.includes(key) || (key === 'day' && finalDay && raw.day === undefined)) continue;
		const n = readPositive(raw, key, path, issues);
		if (n === undefined) return undefined;
		out[key] = n;
	}
	return out;
}

const VERBS: Record<Exclude<JinxRuleKey, 'exclusive'>, Verb> = {
	cannotCreate: enumVerb('via', ['givesAbility', 'changesCharacter']),
	cannotChoose: plain,
	givenInstead: {
		fields: ['instead', 'type', 'upTo', 'where'],
		main: 'instead',
		read: readGivenInstead
	},
	noTurnGood: plain,
	spareToken: plain,
	storytellerChooses: {
		fields: ['what', 'via', 'creating'],
		main: 'what',
		read: (raw, path, issues) => {
			const what = readEnum(raw, 'what', STORYTELLER_CHOOSES, path, issues, true);
			const via = readEnum(raw, 'via', CHOOSES_VIA, path, issues, false);
			const creating = readEnum(raw, 'creating', ['partner'], path, issues, false);
			if (via && what !== 'player') {
				issues.add(`${path}.via`, 'only with `what: "player"`');
				return undefined;
			}
			if (creating && (what !== 'player' || (via ?? 'changesCharacter') !== 'changesCharacter')) {
				issues.add(`${path}.creating`, 'only with `what: "player"` by `changesCharacter`');
				return undefined;
			}
			return what
				? { what, ...(via ? { via } : {}), ...(creating ? { creating } : {}) }
				: undefined;
		}
	},
	wakes: enumVerb('how', ['one-by-one']),
	alsoBecomes: {
		fields: ['type', 'player'],
		main: 'type',
		read: (raw, path, issues) => {
			const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, true);
			const player = readEnum(raw, 'player', ['self', 'neighbour'], path, issues, false);
			return type ? { type, ...(player ? { player } : {}) } : undefined;
		}
	},
	carriedBy: {
		fields: ['type', 'marked'],
		read: (raw, path, issues) => {
			const type = readEnum(raw, 'type', CHARACTER_TYPES, path, issues, false);
			const marked = readString(raw, 'marked', path, issues, false);
			if ((type === undefined) === (marked === undefined)) {
				issues.add(path, 'needs type or marked, not both');
				return undefined;
			}
			return type ? { type } : { marked };
		}
	},
	diesWhenExecuted: plain,
	registersTo: {
		fields: ['alignments', 'types', 'always'],
		read: (raw, path, issues) => {
			const out: Json = {};
			const alignments = readEnumList(raw, 'alignments', ALIGNMENTS, path, issues);
			if (alignments) out.alignments = alignments;
			const types = readEnumList(raw, 'types', CHARACTER_TYPES, path, issues);
			if (types) out.types = types;
			if (readBoolean(raw, 'always', path, issues)) out.always = true;
			if (!out.alignments && !out.types) {
				issues.add(path, 'needs alignments or types');
				return undefined;
			}
			return out;
		}
	},
	impairs: {
		fields: ['kind', 'unlessImpaired'],
		main: 'kind',
		both: true,
		read: (raw, path, issues) => {
			const kind = readEnum(raw, 'kind', IMPAIR_KINDS, path, issues, true);
			const unless = readBoolean(raw, 'unlessImpaired', path, issues);
			return kind ? { kind, ...(unless ? { unlessImpaired: true } : {}) } : undefined;
		}
	},
	noKill: {
		fields: ['on', 'killer', 'token'],
		main: 'on',
		read: (raw, path, issues) => {
			const killer = readEnum(raw, 'killer', ['demon'], path, issues, false);
			const on = readEnum(raw, 'on', NO_KILL_TRIGGERS, path, issues, killer === undefined);
			const token = readString(raw, 'token', path, issues, false);
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
			if (killer) return { killer };
			return on ? { on, ...(token !== undefined ? { token } : {}) } : undefined;
		}
	},
	protects: {
		fields: ['from', 'night', 'by'],
		main: 'from',
		read: (raw, path, issues) => {
			const from = readEnum(raw, 'from', PROTECTS_FROM, path, issues, false) ?? 'any';
			const night = readBoolean(raw, 'night', path, issues);
			const by = readEnum(raw, 'by', ['partner'], path, issues, false);
			return { from, ...(night ? { night: true } : {}), ...(by ? { by } : {}) };
		}
	},
	grimoire: {
		fields: ['hides'],
		main: 'hides',
		read: (raw, path, issues) => {
			if (raw.hides === 'all') return { hides: 'all' };
			const hides = readEnumList(raw, 'hides', GRIMOIRE_HIDDEN, path, issues);
			if (raw.hides === undefined) issues.add(`${path}.hides`, 'missing');
			return hides ? { hides } : undefined;
		}
	},
	endsGame: { fields: [], read: readEnd },
	deadAtLeast: {
		fields: ['dead'],
		main: 'dead',
		read: (raw, path, issues) => {
			const dead = readPositive(raw, 'dead', path, issues);
			return dead === undefined ? undefined : { dead };
		}
	},
	nightChoice: {
		fields: ['chooses', 'partner'],
		read: (raw, path, issues) => {
			const chooses = readEnum(raw, 'chooses', NIGHT_CHOICE_CHOOSES, path, issues, true);
			const partner = readEnum(raw, 'partner', NIGHT_CHOICE_PARTNER, path, issues, true);
			return chooses && partner ? { chooses, partner } : undefined;
		}
	},
	partnerSetup: plain,
	partnerInPlay: plain,
	learns: enumVerb('what', LEARNS),
	trueInfo: plain,
	notDeclared: plain,
	keepsProtection: plain,
	noExecuteNow: {
		fields: ['player', 'token'],
		main: 'player',
		read: (raw, path, issues) => {
			const player = readEnum(raw, 'player', NO_EXECUTE_NOW_PLAYER, path, issues, true);
			const token = readString(raw, 'token', path, issues, player === 'marked');
			if (!player || (player === 'marked' && token === undefined)) return undefined;
			return player === 'marked' ? { player, token } : { player };
		}
	},
	allEvilBecome: plain,
	partnerKeepsAbility: plain,
	storytellerHas: enumVerb('once', STORYTELLER_HAS),
	arbitraryDeaths: plain,
	changesCharacter: labelVerb('token'),
	guessesPartner: plain,
	notShown: enumVerb('what', NOT_SHOWN),
	notSecondDemon: plain,
	keepsAbility: flagVerb('afterDeath'),
	survives: enumVerb('on', ['carrier-executed']),
	killsMarked: labelVerb('token'),
	madAsPartner: plain,
	thinksPartnerSetup: plain,
	voter: flagVerb('countsOnlyWith'),
	abnormalCounts: enumVerb('counts', ABNORMAL_COUNTS)
};

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
	const verb = VERBS[key];
	let obj: Json;
	if (raw === true && verb.main === undefined) obj = {};
	else if (verb.main !== undefined && (typeof raw === 'string' || typeof raw === 'number'))
		obj = { [verb.main]: raw };
	else if (isObject(raw)) obj = raw;
	else {
		issues.add(
			path,
			`expected ${verb.main ? 'a value or object' : 'true or object'}, got ${describe(raw)}`
		);
		return undefined;
	}
	const before = issues.list.length;
	if (key !== 'endsGame') checkKeys(obj, [...verb.fields, 'who', 'when'], path, issues);
	const who = readEnum(
		obj,
		'who',
		verb.both ? [...JINX_WHO, 'both'] : JINX_WHO,
		path,
		issues,
		false
	);
	let when: JinxCondition[] | undefined;
	if (obj.when !== undefined) {
		if (!Array.isArray(obj.when) || obj.when.length === 0)
			issues.add(`${path}.when`, `expected a list of conditions, got ${describe(obj.when)}`);
		else when = obj.when.map((c, i) => readCondition(c, `${path}.when[${i}]`, issues)!);
	}
	const params = verb.read(obj, path, issues);
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
