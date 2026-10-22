/**
 * Parsers for TPI's data files and for scripts. They take untrusted JSON (`unknown`),
 * validate it, map TPI's `team` to our `type`, and throw a `DataError` listing every
 * problem found.
 */
import { parseCharacterRules, type CharacterRules } from './character-rules.ts';
import {
	CHARACTER_TYPES,
	SPECIAL_GLOBALS,
	SPECIAL_NAMES,
	SPECIAL_TIMES,
	SPECIAL_TYPES,
	type Character,
	type Jinx,
	type NightSheet,
	type Script,
	type ScriptEntry,
	type ScriptMeta,
	type Special
} from './types.ts';
import {
	checkKeys,
	describe,
	Issues,
	isObject,
	readBoolean,
	readEnum,
	readNumber,
	readString,
	readStringArray
} from './validate.ts';

/** Character ids: lower-case letters and digits (`script-schema.json`). */
export const CHARACTER_ID_PATTERN = /^[a-z0-9]+$/;

const ROLE_KEYS = [
	'id',
	'name',
	'team',
	'edition',
	'ability',
	'flavor',
	'setup',
	'reminders',
	'remindersGlobal',
	'firstNightReminder',
	'otherNightReminder',
	'special'
] as const;
const SCRIPT_CHARACTER_KEYS = [
	...ROLE_KEYS,
	'image',
	'firstNight',
	'otherNight',
	'jinxes',
	'rules'
] as const;
const SPECIAL_KEYS = ['type', 'name', 'value', 'time', 'global'] as const;

export interface CharacterOptions {
	/** Reject fields that are not in TPI's format (used for TPI's own files). */
	strict: boolean;
	/** Allow `image`, numeric night order and `jinxes` (script characters only). */
	scriptFields: boolean;
}

export function parseSpecial(raw: unknown, path: string, issues: Issues): Special | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	checkKeys(raw, SPECIAL_KEYS, path, issues);
	const type = readEnum(raw, 'type', SPECIAL_TYPES, path, issues, true);
	const name = readEnum(raw, 'name', SPECIAL_NAMES, path, issues, true);
	const time = readEnum(raw, 'time', SPECIAL_TIMES, path, issues, false);
	const global = readEnum(raw, 'global', SPECIAL_GLOBALS, path, issues, false);
	const value = raw.value;
	if (value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
		issues.add(`${path}.value`, `expected string or number, got ${describe(value)}`);
	}
	if (type === undefined || name === undefined) return undefined;
	const special: Special = { type, name };
	if (typeof value === 'string' || typeof value === 'number') special.value = value;
	if (time !== undefined) special.time = time;
	if (global !== undefined) special.global = global;
	return special;
}

/** Empty night text means the character does not act that night. */
function nightText(raw: Record<string, unknown>, key: string, path: string, issues: Issues) {
	const text = readString(raw, key, path, issues, false);
	return text === undefined || text.trim() === '' ? undefined : text;
}

export function parseCharacter(
	raw: unknown,
	path: string,
	issues: Issues,
	options: CharacterOptions
): Character | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	if (options.strict) {
		checkKeys(raw, options.scriptFields ? SCRIPT_CHARACTER_KEYS : ROLE_KEYS, path, issues);
	}
	const before = issues.list.length;
	const id = readString(raw, 'id', path, issues, true);
	if (id !== undefined && !CHARACTER_ID_PATTERN.test(id)) {
		issues.add(`${path}.id`, `${JSON.stringify(id)} is not lower-case letters and digits`);
	}
	const name = readString(raw, 'name', path, issues, true);
	const type = readEnum(raw, 'team', CHARACTER_TYPES, path, issues, true);
	const ability = readString(raw, 'ability', path, issues, true);
	const edition = readString(raw, 'edition', path, issues, false);
	const flavor = readString(raw, 'flavor', path, issues, false);
	const setup = readBoolean(raw, 'setup', path, issues) ?? false;
	const reminders = readStringArray(raw, 'reminders', path, issues) ?? [];
	const remindersGlobal = readStringArray(raw, 'remindersGlobal', path, issues) ?? [];
	const firstNightReminder = nightText(raw, 'firstNightReminder', path, issues);
	const otherNightReminder = nightText(raw, 'otherNightReminder', path, issues);

	const special: Special[] = [];
	if (raw.special !== undefined) {
		if (Array.isArray(raw.special)) {
			raw.special.forEach((item, i) => {
				const parsed = parseSpecial(item, `${path}.special[${i}]`, issues);
				if (parsed) special.push(parsed);
			});
		} else {
			issues.add(`${path}.special`, `expected array, got ${describe(raw.special)}`);
		}
	}

	let image: string | string[] | undefined;
	let firstNight: number | undefined;
	let otherNight: number | undefined;
	let rules: CharacterRules | undefined;
	if (options.scriptFields) {
		if (typeof raw.image === 'string') image = raw.image;
		else if (raw.image !== undefined) image = readStringArray(raw, 'image', path, issues);
		firstNight = readNumber(raw, 'firstNight', path, issues);
		otherNight = readNumber(raw, 'otherNight', path, issues);
		if (raw.rules !== undefined)
			rules = parseCharacterRules(raw.rules, `${path}.rules`, issues, reminders);
	}

	if (issues.list.length > before) return undefined;
	const character: Character = {
		id: id!,
		name: name!,
		type: type!,
		ability: ability!,
		setup,
		reminders,
		remindersGlobal,
		special
	};
	if (edition !== undefined) character.edition = edition;
	if (flavor !== undefined) character.flavor = flavor;
	if (firstNightReminder !== undefined) character.firstNightReminder = firstNightReminder;
	if (otherNightReminder !== undefined) character.otherNightReminder = otherNightReminder;
	if (image !== undefined) character.image = image;
	if (firstNight !== undefined) character.firstNight = firstNight;
	if (rules !== undefined) character.rules = rules;
	if (otherNight !== undefined) character.otherNight = otherNight;
	return character;
}

/** Parses TPI's `roles.json`. Strict: unknown fields fail, so upstream schema changes are noticed. */
export function parseRoles(json: unknown): Character[] {
	const issues = new Issues();
	const characters: Character[] = [];
	if (!Array.isArray(json)) {
		issues.add('', `expected array, got ${describe(json)}`);
		issues.throwIfAny('roles.json');
	}
	const seen = new Set<string>();
	(json as unknown[]).forEach((raw, i) => {
		const character = parseCharacter(raw, `[${i}]`, issues, { strict: true, scriptFields: false });
		if (!character) return;
		if (seen.has(character.id)) issues.add(`[${i}].id`, `duplicate id ${character.id}`);
		seen.add(character.id);
		characters.push(character);
	});
	issues.throwIfAny('roles.json');
	return characters;
}

/** Parses TPI's `jinxes.json` (`[{ id, jinx: [{ id, reason }] }]`) into one entry per pair. */
export function parseJinxes(json: unknown): Jinx[] {
	const issues = new Issues();
	const jinxes: Jinx[] = [];
	if (!Array.isArray(json)) {
		issues.add('', `expected array, got ${describe(json)}`);
		issues.throwIfAny('jinxes.json');
	}
	const pairs = new Set<string>();
	(json as unknown[]).forEach((entry, i) => {
		const path = `[${i}]`;
		if (!isObject(entry)) {
			issues.add(path, `expected object, got ${describe(entry)}`);
			return;
		}
		checkKeys(entry, ['id', 'jinx'], path, issues);
		const id = readString(entry, 'id', path, issues, true);
		if (!Array.isArray(entry.jinx)) {
			issues.add(`${path}.jinx`, `expected array, got ${describe(entry.jinx)}`);
			return;
		}
		entry.jinx.forEach((item, j) => {
			const itemPath = `${path}.jinx[${j}]`;
			if (!isObject(item)) {
				issues.add(itemPath, `expected object, got ${describe(item)}`);
				return;
			}
			checkKeys(item, ['id', 'reason'], itemPath, issues);
			const other = readString(item, 'id', itemPath, issues, true);
			const reason = readString(item, 'reason', itemPath, issues, true);
			if (id === undefined || other === undefined || reason === undefined) return;
			if (id === other) issues.add(itemPath, `${id} is jinxed with itself`);
			const key = pairKey(id, other);
			if (pairs.has(key)) issues.add(itemPath, `duplicate jinx ${id} + ${other}`);
			pairs.add(key);
			jinxes.push({ characters: [id, other], reason });
		});
	});
	issues.throwIfAny('jinxes.json');
	return jinxes;
}

/** Order-independent key for a pair of character ids. */
export function pairKey(a: string, b: string): string {
	return a < b ? `${a}+${b}` : `${b}+${a}`;
}

/** Parses TPI's `nightsheet.json`. */
export function parseNightSheet(json: unknown): NightSheet {
	const issues = new Issues();
	if (!isObject(json)) {
		issues.add('', `expected object, got ${describe(json)}`);
		issues.throwIfAny('nightsheet.json');
	}
	const obj = json as Record<string, unknown>;
	checkKeys(obj, ['firstNight', 'otherNight'], '', issues);
	const sheet: NightSheet = { firstNight: [], otherNight: [] };
	for (const night of ['firstNight', 'otherNight'] as const) {
		if (!Array.isArray(obj[night])) {
			issues.add(night, `expected array, got ${describe(obj[night])}`);
			continue;
		}
		const list = readStringArray(obj, night, '', issues) ?? [];
		const seen = new Set<string>();
		list.forEach((id, i) => {
			if (seen.has(id)) issues.add(`${night}[${i}]`, `duplicate ${id}`);
			seen.add(id);
		});
		sheet[night] = list;
	}
	issues.throwIfAny('nightsheet.json');
	return sheet;
}

function parseMeta(raw: Record<string, unknown>, path: string, issues: Issues): ScriptMeta {
	const meta: ScriptMeta = { name: readString(raw, 'name', path, issues, false) ?? '' };
	for (const key of ['author', 'logo', 'background', 'almanac'] as const) {
		const value = readString(raw, key, path, issues, false);
		if (value !== undefined) meta[key] = value;
	}
	const hideTitle = readBoolean(raw, 'hideTitle', path, issues);
	if (hideTitle !== undefined) meta.hideTitle = hideTitle;
	for (const key of ['bootlegger', 'firstNight', 'otherNight'] as const) {
		const value = readStringArray(raw, key, path, issues);
		if (value !== undefined) meta[key] = value;
	}
	return meta;
}

/**
 * Parses a script in TPI's format (`script-schema.json`): an array of character ids,
 * `{ id }` objects (deprecated), full character objects (homebrew), and an optional
 * `_meta` entry. Unknown fields are ignored so scripts from other tools still load.
 */
export function parseScript(json: unknown): Script {
	const issues = new Issues();
	if (!Array.isArray(json)) {
		issues.add('', `expected array, got ${describe(json)}`);
		issues.throwIfAny('script');
	}
	const script: Script = { entries: [] };
	const seen = new Set<string>();
	const add = (entry: ScriptEntry, path: string) => {
		const id = entry.kind === 'official' ? entry.id : entry.character.id;
		if (seen.has(id)) issues.add(path, `${id} is listed twice`);
		seen.add(id);
		script.entries.push(entry);
	};
	(json as unknown[]).forEach((raw, i) => {
		const path = `[${i}]`;
		if (typeof raw === 'string') {
			// Older tools wrote ids with capitals, underscores or hyphens ("fortune_teller").
			add({ kind: 'official', id: normaliseCharacterId(raw) }, path);
			return;
		}
		if (!isObject(raw)) {
			issues.add(path, `expected string or object, got ${describe(raw)}`);
			return;
		}
		if (raw.id === '_meta') {
			if (script.meta) issues.add(path, 'more than one _meta entry');
			script.meta = parseMeta(raw, path, issues);
			return;
		}
		const keys = Object.keys(raw);
		if (keys.length === 1 && typeof raw.id === 'string') {
			add({ kind: 'official', id: normaliseCharacterId(raw.id) }, path);
			return;
		}
		const character = parseCharacter(raw, path, issues, { strict: false, scriptFields: true });
		if (character) add({ kind: 'custom', character }, path);
	});
	issues.throwIfAny('script');
	return script;
}

/**
 * Lower-cases an id, folds accented letters to their base letter (NFKD) and drops anything
 * that is not a letter or digit, so "Fortune Teller", "fortune_teller" and "Lil' Monsta"
 * become TPI's `fortuneteller` and `lilmonsta`. Ids in other scripts (Cyrillic, Greek)
 * normalise to an empty string; callers must handle that (see `script.ts`).
 */
export function normaliseCharacterId(id: string): string {
	return id
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}
