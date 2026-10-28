/**
 * SPIKE: reads an ability parts block, recording each problem with its JSON path (the same
 * `Issues` the rules files use). It checks the vocabulary (every `at`, `do`, subject, limit
 * and event is one the app knows) and that a clause's own references hold together: an
 * effect on `chosen` needs a `choose`, and a reminder must be one of the character's own.
 */
import { Issues, isObject, describe, checkKeys } from '#lib/core/data/validate.ts';
import type { ReminderLabel } from '#lib/core/data/types.ts';
import { EVENTS, LIMITS, NIGHTS, SUBJECTS, type AbilityParts, type Clause } from './types.ts';

const CLAUSE_KEYS = [
	'id',
	'when',
	'limit',
	'if',
	'choose',
	'publicly',
	'optional',
	'storytellerMay',
	'evenIfDead',
	'evenIfImpaired',
	'effects',
	'marks',
	'spent'
];

const WHEN_AT = ['setup', 'night', 'day', 'dusk', 'always', 'death', 'nominated', 'event'];

/** Each verb and the fields it may have. */
const EFFECT_FIELDS: Record<string, readonly string[]> = {
	learn: ['info', 'to'],
	protect: ['who', 'from', 'until', 'once'],
	kill: ['who', 'ignoresProtection'],
	resurrect: ['who'],
	impair: ['who', 'as', 'until', 'whileWorks'],
	'lose-ability': ['who'],
	boost: ['who', 'how', 'until'],
	'keep-ability': ['who', 'until'],
	'gain-ability': ['who', 'of'],
	'falsify-info': ['of', 'who'],
	'skip-waking': ['who'],
	arm: ['who', 'on', 'until', 'effects'],
	later: ['at', 'if', 'effects'],
	madness: ['who', 'as', 'until'],
	swap: ['who', 'with', 'what'],
	'game-rule': ['rule'],
	'hold-game': ['while', 'extraDay'],
	'register-dead': ['who'],
	immune: ['who', 'to'],
	register: ['who', 'as', 'toSelfOnly'],
	believe: ['who', 'isA', 'choicesAsDemon'],
	become: ['who', 'into', 'evil'],
	execute: ['who', 'instead'],
	'end-game': ['winner'],
	'redirect-death': ['to'],
	'vote-weight': ['who', 'counts', 'until'],
	'vote-only-with': ['who', 'with', 'until'],
	'vote-needs-token': ['who'],
	setup: ['modifier'],
	storyteller: ['note'],
	// Carousel Outsiders & Travellers batch.
	'must-vote': ['who'],
	'invert-winner': []
};

const oneOf = (value: unknown, allowed: readonly string[]) =>
	typeof value === 'string' && allowed.includes(value);

export function readAbilityParts(
	raw: unknown,
	path: string,
	issues: Issues,
	reminders?: readonly ReminderLabel[]
): AbilityParts | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['clauses', 'hatches'], path, issues);
	if (!Array.isArray(raw.clauses) || raw.clauses.length === 0) {
		issues.add(`${path}.clauses`, 'expected a non-empty array');
		return undefined;
	}
	const ids = new Set<string>();
	raw.clauses.forEach((clause: unknown, i: number) => {
		const at = `${path}.clauses[${i}]`;
		if (!isObject(clause)) return issues.add(at, `expected object, got ${describe(clause)}`);
		checkKeys(clause, CLAUSE_KEYS, at, issues);
		const c = clause as unknown as Clause;
		if (typeof c.id !== 'string' || ids.has(c.id)) issues.add(`${at}.id`, 'missing or repeated');
		ids.add(c.id);
		if (!isObject(c.when) || !oneOf(c.when.at, WHEN_AT)) issues.add(`${at}.when`, 'unknown');
		else if (c.when.at === 'night' && !oneOf(c.when.nights, NIGHTS))
			issues.add(`${at}.when.nights`, 'unknown');
		else if (c.when.at === 'event' && !oneOf(c.when.event, EVENTS))
			issues.add(`${at}.when.event`, 'unknown');
		if (c.limit !== undefined && !oneOf(c.limit, LIMITS)) issues.add(`${at}.limit`, 'unknown');
		for (const key of ['marks', 'spent'] as const) {
			const label = c[key];
			if (label !== undefined && reminders && !reminders.includes(label))
				issues.add(`${at}.${key}`, `"${label}" is not one of its reminders`);
		}
		readEffects(c.effects, c, `${at}.effects`, issues);
	});
	return raw as unknown as AbilityParts;
}

/** Checks a list of effects; `arm` and `later` hold their own, checked the same way. */
function readEffects(effects: unknown, c: Clause, path: string, issues: Issues): void {
	if (!Array.isArray(effects) || effects.length === 0)
		return issues.add(path, 'expected a non-empty array');
	effects.forEach((effect: unknown, j: number) => {
		const e = `${path}[${j}]`;
		if (!isObject(effect) || typeof effect.do !== 'string' || !(effect.do in EFFECT_FIELDS))
			return issues.add(e, 'unknown verb');
		checkKeys(effect, ['do', 'marks', ...EFFECT_FIELDS[effect.do]], e, issues);
		for (const key of ['who', 'to', 'with'] as const) {
			const subject = (effect as Record<string, unknown>)[key];
			if (key === 'to' && effect.do === 'immune') continue;
			if (subject === undefined) continue;
			if (!oneOf(subject, SUBJECTS)) issues.add(`${e}.${key}`, 'unknown subject');
			else if (subject === 'chosen' && !c.choose) issues.add(`${e}.${key}`, 'nothing is chosen');
		}
		if (effect.do === 'arm' || effect.do === 'later')
			readEffects(effect.effects, c, `${e}.effects`, issues);
	});
}
