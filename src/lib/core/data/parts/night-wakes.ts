import { SEATED_TYPES, type CharacterId, type SeatedType } from '../types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readStringArray,
	type Issues
} from '../validate.ts';
import { objectPart } from './part.ts';

const WAKE_NIGHTS = ['each-night', 'each-night-except-first', 'one-night'] as const;

/**
 * Players a rule source wakes at night, on top of the night order: these `characters` or
 * `types`, or with `dead` every dead player together (Council of the Dead,
 * https://beardytas.com/garden-of-djinn/council-of-the-dead/), on the nights `when` says
 * (`night` for `one-night`, 1 being the first), for `minutes` when given.
 */
export interface NightWake {
	when: (typeof WAKE_NIGHTS)[number];
	night?: number;
	characters?: CharacterId[];
	types?: SeatedType[];
	dead?: true;
	minutes?: number;
}

function readWake(raw: unknown, path: string, issues: Issues): NightWake | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, ['when', 'night', 'characters', 'types', 'dead', 'minutes'], path, issues);
	const before = issues.list.length;
	const when = readEnum(raw, 'when', WAKE_NIGHTS, path, issues, true);
	const night = readNumber(raw, 'night', path, issues);
	const characters = readStringArray(raw, 'characters', path, issues);
	const types = readStringArray(raw, 'types', path, issues);
	if (types?.some((t) => !(SEATED_TYPES as readonly string[]).includes(t)))
		issues.add(`${path}.types`, `expected a list of ${SEATED_TYPES.join(', ')}`);
	const dead = readBoolean(raw, 'dead', path, issues);
	const minutes = readNumber(raw, 'minutes', path, issues);
	for (const [key, value] of [
		['night', night],
		['minutes', minutes]
	] as const)
		if (value !== undefined && (!Number.isInteger(value) || value < 1))
			issues.add(`${path}.${key}`, 'expected a whole number of at least 1');
	if (when === 'one-night' && night === undefined) issues.add(`${path}.night`, 'missing');
	if (!when || issues.list.length > before) return undefined;
	return {
		when,
		...(night !== undefined ? { night } : {}),
		...(characters ? { characters } : {}),
		...(types ? { types: types as SeatedType[] } : {}),
		...(dead ? { dead: true as const } : {}),
		...(minutes !== undefined ? { minutes } : {})
	};
}

function readNightWakes(raw: unknown, path: string, issues: Issues): NightWake[] | undefined {
	if (!Array.isArray(raw)) {
		issues.add(path, `expected array, got ${describe(raw)}`);
		return undefined;
	}
	const wakes = raw.map((item, i) => readWake(item, `${path}[${i}]`, issues));
	return wakes.every((w) => w !== undefined) ? (wakes as NightWake[]) : undefined;
}

/** Players it wakes at night, on top of the night order (`features/grimoire/night-steps.ts`). */
export const nightWakes = objectPart(
	'Night wakes',
	'Players it wakes at night, on top of the night order.',
	readNightWakes
);
