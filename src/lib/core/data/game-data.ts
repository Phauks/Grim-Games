/**
 * Loads TPI's data files together and checks that they agree with each other, so the
 * rest of core can trust every id it meets.
 */
import { indexJinxes, type JinxIndex } from './jinxes.ts';
import { parseJinxes, parseNightSheet, parseRoles } from './parse.ts';
import {
	CHARACTER_TYPES,
	NIGHT_MARKERS,
	SPECIAL_GLOBALS,
	SPECIAL_NAMES,
	SPECIAL_TIMES,
	SPECIAL_TYPES,
	type Character,
	type CharacterId,
	type NightSheet
} from './types.ts';
import { Issues, isObject } from './validate.ts';

export interface GameData {
	/** Every official character, in TPI's order. */
	characters: readonly Character[];
	byId: ReadonlyMap<CharacterId, Character>;
	jinxes: JinxIndex;
	nightSheet: NightSheet;
}

/** The raw JSON of `roles.json`, `jinxes.json` and `nightsheet.json`. */
export interface RawGameData {
	roles: unknown;
	jinxes: unknown;
	nightsheet: unknown;
}

export function loadGameData(raw: RawGameData): GameData {
	const characters = parseRoles(raw.roles);
	const jinxes = parseJinxes(raw.jinxes);
	const nightSheet = parseNightSheet(raw.nightsheet);
	const byId = new Map(characters.map((c) => [c.id, c]));

	const issues = new Issues();
	jinxes.forEach(({ characters: pair }) => {
		for (const id of pair) {
			if (!byId.has(id))
				issues.add(`jinxes.json`, `jinx ${pair.join(' + ')}: unknown character ${id}`);
		}
	});

	const markers: readonly string[] = NIGHT_MARKERS;
	for (const night of ['firstNight', 'otherNight'] as const) {
		const reminderKey = night === 'firstNight' ? 'firstNightReminder' : 'otherNightReminder';
		const listed = new Set(nightSheet[night]);
		for (const id of nightSheet[night]) {
			if (markers.includes(id)) continue;
			const character = byId.get(id);
			if (!character) issues.add(`nightsheet.json ${night}`, `unknown character ${id}`);
			else if (character[reminderKey] === undefined) {
				issues.add(`nightsheet.json ${night}`, `${id} is listed but has no ${reminderKey}`);
			}
		}
		for (const character of characters) {
			if (character[reminderKey] !== undefined && !listed.has(character.id)) {
				issues.add(`roles.json ${character.id}`, `has ${reminderKey} but is not in ${night}`);
			}
		}
	}
	issues.throwIfAny('game data (files disagree)');

	return { characters, byId, jinxes: indexJinxes(jinxes), nightSheet };
}

function enumAt(schema: unknown, path: readonly string[]): unknown {
	let node: unknown = schema;
	for (const key of path) node = isObject(node) ? node[key] : undefined;
	return node;
}

function sameSet(actual: unknown, expected: readonly string[]): boolean {
	return (
		Array.isArray(actual) &&
		actual.length === expected.length &&
		expected.every((value) => actual.includes(value))
	);
}

/**
 * Checks that TPI's `script-schema.json` still uses the vocabulary our types encode
 * (character types, `special` names, times and globals). A mismatch means the types in
 * `types.ts` need updating, so the sync fails rather than shipping data we cannot read.
 */
export function checkScriptSchema(schema: unknown): void {
	const issues = new Issues();
	const variants = enumAt(schema, ['items', 'oneOf']);
	if (!Array.isArray(variants)) {
		issues.add('items.oneOf', 'missing');
		issues.throwIfAny('script-schema.json');
	}
	const character = (variants as unknown[]).find(
		(v) => isObject(v) && isObject(v.properties) && isObject(v.properties.team)
	);
	if (!character) {
		issues.add('items.oneOf', 'no character entry with a team property');
		issues.throwIfAny('script-schema.json');
	}
	const special = ['properties', 'special', 'items', 'properties'];
	const checks: [readonly string[], readonly string[]][] = [
		[['properties', 'team', 'enum'], CHARACTER_TYPES],
		[[...special, 'type', 'enum'], SPECIAL_TYPES],
		[[...special, 'name', 'enum'], SPECIAL_NAMES],
		[[...special, 'time', 'enum'], SPECIAL_TIMES],
		[[...special, 'global', 'enum'], SPECIAL_GLOBALS]
	];
	for (const [path, expected] of checks) {
		const actual = enumAt(character, path);
		if (!sameSet(actual, expected)) {
			issues.add(
				`character.${path.join('.')}`,
				`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
			);
		}
	}
	issues.throwIfAny('script-schema.json (vocabulary changed)');
}
