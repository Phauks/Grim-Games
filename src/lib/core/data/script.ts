/**
 * Script loader: official editions by id or name, and script JSON pasted or uploaded in
 * any shape TPI's `script-schema.json` allows, plus the odd shapes found in the wild.
 *
 * Unlike `parseScript` (strict, throws), this loader never gives up on a whole script
 * because of one bad entry: it loads what it can and returns a list of problems in plain
 * language. Pocket Grimoire's recurring breakages were all homebrew scripts with unusual
 * shapes (03-issues-and-requests.md: PG 190 and PG 195 custom JSON refused, PG 127 underscores in
 * custom ids, PG 111 and PG 153 Cyrillic and umlauts), so every one of those has a fixture test.
 *
 * Format reference: https://wiki.bloodontheclocktower.com/Script_Tool links to the tool;
 * the JSON format itself is TPI's `script-schema.json` (botc-release).
 */
import type { GameData } from './game-data.ts';
import { normaliseCharacterId, parseCharacter, parseSpecial } from './parse.ts';
import {
	CHARACTER_TYPES,
	NIGHT_MARKERS,
	type Character,
	type CharacterId,
	type CharacterType,
	type Jinx,
	type Script,
	type ScriptMeta,
	type Special
} from './types.ts';
import { describe, Issues, isObject, type Json } from './validate.ts';

export type ScriptProblemSeverity = 'error' | 'warning' | 'info';

/**
 * Something the loader could not use (`error`: that part was skipped), changed to make it
 * usable (`warning`), or just wants to mention (`info`). Messages are written for the
 * Storyteller, not for developers.
 */
export interface ScriptProblem {
	severity: ScriptProblemSeverity;
	/** Where in the script: "Entry 4 (fortune_teler)", "Script details", "JSON". */
	where: string;
	message: string;
}

/** A script ready to play: official characters resolved, homebrew characters validated. */
export interface LoadedScript {
	/**
	 * Display name: `_meta.name`, or the edition name; empty when the script has none (no
	 * invented name, Trevor 2026-10-16: UIs show "None").
	 */
	name: string;
	meta: ScriptMeta;
	/** Set when this is an official edition loaded by id (`tb`, `bmr`, `snv`). */
	edition?: string;
	/** Every character on the script, in script order, without duplicates. */
	characters: Character[];
	/** Ids of characters defined by the script itself (homebrew, or official ids overridden). */
	homebrew: CharacterId[];
	/** Jinxes declared by homebrew characters (`jinxes` on a script character). */
	homebrewJinxes: Jinx[];
	/** Ids the loader rewrote, original → id used ("fortune_teller" → "fortuneteller"). */
	renamedIds: Record<string, CharacterId>;
}

export interface ScriptLoadResult {
	/** Undefined only when nothing usable was found (not JSON, no characters at all). */
	script?: LoadedScript;
	problems: ScriptProblem[];
	/** True when there are no `error` problems. Warnings and info do not count. */
	ok: boolean;
}

/** The official editions that are playable scripts on their own. */
export const OFFICIAL_EDITIONS = [
	{ id: 'tb', name: 'Trouble Brewing' },
	{ id: 'bmr', name: 'Bad Moon Rising' },
	{ id: 'snv', name: 'Sects & Violets' }
] as const;
export type OfficialEditionId = (typeof OFFICIAL_EDITIONS)[number]['id'];

const PLAYABLE_TYPES: readonly CharacterType[] = ['townsfolk', 'outsider', 'minion', 'demon'];

/** Finds an official edition by id or name, forgiving case, spacing and "&" vs "and". */
export function findEdition(query: string): (typeof OFFICIAL_EDITIONS)[number] | undefined {
	const key = normaliseCharacterId(query.replace(/&/g, 'and'));
	return OFFICIAL_EDITIONS.find(
		(e) => e.id === key || normaliseCharacterId(e.name.replace(/&/g, 'and')) === key
	);
}

/**
 * An official edition as a script: its Townsfolk, Outsiders, Minions and Demons in TPI's
 * order (the edition's Travellers are not on the script sheet; they can join any game).
 * https://wiki.bloodontheclocktower.com/Trouble_Brewing (and the BMR / S&V pages)
 */
export function editionScript(edition: string, data: GameData): LoadedScript | undefined {
	const found = findEdition(edition);
	if (!found) return undefined;
	return {
		name: found.name,
		meta: { name: found.name, author: 'The Pandemonium Institute' },
		edition: found.id,
		characters: data.characters.filter(
			(c) => c.edition === found.id && PLAYABLE_TYPES.includes(c.type)
		),
		homebrew: [],
		homebrewJinxes: [],
		renamedIds: {}
	};
}

const MARKERS: readonly string[] = NIGHT_MARKERS;

/** Where a JSON.parse error happened, as "line 3, column 5". */
function jsonErrorPosition(text: string, error: unknown): string | undefined {
	const message = error instanceof Error ? error.message : String(error);
	const lineCol = /line (\d+) column (\d+)/.exec(message);
	if (lineCol) return `line ${lineCol[1]}, column ${lineCol[2]}`;
	const pos = /position (\d+)/.exec(message);
	if (!pos) return undefined;
	const before = text.slice(0, Number(pos[1]));
	const line = before.split('\n').length;
	const column = before.length - before.lastIndexOf('\n');
	return `line ${line}, column ${column}`;
}

/**
 * Loads a script from text: an edition id or name ("tb", "Bad Moon Rising"), or script JSON
 * as pasted or read from a file. Handles a byte-order mark, “smart quotes” from messaging
 * apps and trailing commas, each with a warning.
 */
export function loadScriptText(text: string, data: GameData): ScriptLoadResult {
	const trimmed = text.replace(/^\uFEFF/, '').trim();
	if (trimmed === '') {
		return failed('Script', 'The script is empty. Paste the script JSON or choose a file.');
	}
	const edition = findEdition(trimmed);
	if (edition && !/^[[{]/.test(trimmed)) {
		return { script: editionScript(edition.id, data), problems: [], ok: true };
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return failed(
			'Script',
			'This is a link, not script JSON. Use “Load from a link”, or open the link and paste what it shows.'
		);
	}
	const fixes: ScriptProblem[] = [];
	let json: unknown;
	try {
		json = JSON.parse(trimmed);
	} catch (error) {
		// Retry with the two repairs that cover most hand-edited scripts.
		let repaired = trimmed;
		if (/[“”]/.test(repaired)) {
			repaired = repaired.replace(/[“”]/g, '"');
			fixes.push(
				warn(
					'JSON',
					'Curly quotes (“ ”) were replaced with straight quotes. A messaging app may have changed them.'
				)
			);
		}
		if (/,\s*[\]}]/.test(repaired)) {
			repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
			fixes.push(warn('JSON', 'Commas before a closing ] or } were removed.'));
		}
		try {
			if (fixes.length === 0) throw error;
			json = JSON.parse(repaired);
		} catch (second) {
			const at = jsonErrorPosition(repaired, second);
			return failed(
				'JSON',
				`This is not valid script JSON${at ? ` (problem near ${at})` : ''}. Check that it was copied in full.`
			);
		}
	}
	const result = loadScript(json, data);
	return { ...result, problems: [...fixes, ...result.problems] };
}

function problem(severity: ScriptProblemSeverity, where: string, message: string): ScriptProblem {
	return { severity, where, message };
}
const error = (where: string, message: string) => problem('error', where, message);
const warn = (where: string, message: string) => problem('warning', where, message);
const info = (where: string, message: string) => problem('info', where, message);

function failed(where: string, message: string): ScriptLoadResult {
	return { problems: [error(where, message)], ok: false };
}

/** Plain-language list of the character types, for error messages. */
const TYPE_LIST = CHARACTER_TYPES.join(', ');

/** Team spellings seen in the wild: capitals, plurals, US "traveler". */
function normaliseTeam(raw: unknown): CharacterType | undefined {
	if (typeof raw !== 'string') return undefined;
	let key = raw.trim().toLowerCase().replace(/\s+/g, '');
	if (key === 'traveler' || key === 'travelers') key = 'traveller';
	if (key === 'fable') key = 'fabled';
	if (!(CHARACTER_TYPES as readonly string[]).includes(key) && key.endsWith('s')) {
		key = key.slice(0, -1);
	}
	return (CHARACTER_TYPES as readonly string[]).includes(key) ? (key as CharacterType) : undefined;
}

/** Edit distance, for "did you mean" suggestions on unknown ids. */
function distance(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let prev = row[0];
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const tmp = row[j];
			row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = tmp;
		}
	}
	return row[b.length];
}

function suggest(id: string, data: GameData): Character | undefined {
	let best: Character | undefined;
	let bestScore = Infinity;
	for (const c of data.characters) {
		const score = distance(id, c.id);
		if (score < bestScore) {
			bestScore = score;
			best = c;
		}
	}
	return bestScore <= Math.max(2, Math.floor(id.length / 4)) ? best : undefined;
}

function label(index: number, id?: unknown): string {
	return typeof id === 'string' && id !== '' ? `Entry ${index + 1} (${id})` : `Entry ${index + 1}`;
}

/** Finds the character list in a top-level object some tools export instead of an array. */
function unwrapObject(json: Json): { list?: unknown[]; meta?: Json } {
	for (const key of ['characters', 'roles', 'script', 'data']) {
		if (Array.isArray(json[key])) {
			const meta = isObject(json._meta)
				? json._meta
				: typeof json.name === 'string'
					? json
					: isObject(json.meta)
						? json.meta
						: undefined;
			return { list: json[key] as unknown[], meta };
		}
	}
	return {};
}

/**
 * Loads a parsed script value. Accepts everything `script-schema.json` allows (string ids,
 * `{ id }` objects, full homebrew characters, `_meta` anywhere in the list) and repairs or
 * skips the rest, reporting each problem.
 */
export function loadScript(json: unknown, data: GameData): ScriptLoadResult {
	const problems: ScriptProblem[] = [];
	let list: unknown[];
	let metaRaw: Json | undefined;
	if (Array.isArray(json)) list = json;
	else if (isObject(json)) {
		const unwrapped = unwrapObject(json);
		if (!unwrapped.list) {
			if (json.id === '_meta') {
				return failed('Script', 'This only has the script details (_meta), no characters.');
			}
			return failed(
				'Script',
				'A script is a list of characters in [ ], but this is a single { } object.'
			);
		}
		list = unwrapped.list;
		metaRaw = unwrapped.meta;
		problems.push(
			info('Script', 'The character list was inside an object; it was read from there.')
		);
	} else {
		return failed('Script', `A script is a list of characters, but this is a ${describe(json)}.`);
	}

	const characters: Character[] = [];
	const homebrew: CharacterId[] = [];
	const homebrewJinxes: Jinx[] = [];
	const renamedIds: Record<string, CharacterId> = {};
	const seen = new Map<CharacterId, string>();
	let customCount = 0;

	const add = (character: Character, where: string, isHomebrew: boolean) => {
		const first = seen.get(character.id);
		if (first !== undefined) {
			problems.push(warn(where, `${character.name} is already on the script (${first}); skipped.`));
			return;
		}
		seen.set(character.id, where);
		characters.push(character);
		if (isHomebrew) homebrew.push(character.id);
	};

	const official = (rawId: string, where: string): Character | undefined => {
		const id = normaliseCharacterId(rawId);
		const character = data.byId.get(id);
		if (character) {
			if (id !== rawId) renamedIds[rawId] = id;
			return character;
		}
		const near = id ? suggest(id, data) : undefined;
		problems.push(
			error(
				where,
				`“${rawId}” is not an official character id${near ? `. Did you mean ${near.name} (${near.id})?` : '.'} Skipped.`
			)
		);
		return undefined;
	};

	list.forEach((raw, index) => {
		if (typeof raw === 'string') {
			const where = label(index, raw);
			if (raw === '_meta') {
				problems.push(warn(where, 'A bare "_meta" string has no script details; ignored.'));
				return;
			}
			const character = official(raw, where);
			if (character) add(character, where, false);
			return;
		}
		if (!isObject(raw)) {
			problems.push(
				error(
					label(index),
					`Expected a character id or a character object, but found ${describe(raw)}. Skipped.`
				)
			);
			return;
		}
		const where = label(index, raw.id ?? raw.name);
		if (typeof raw.id === 'string' && normaliseCharacterId(raw.id) === 'meta') {
			if (metaRaw)
				problems.push(warn(where, 'The script has more than one _meta; used the first.'));
			else metaRaw = raw;
			return;
		}
		const isFull = raw.team !== undefined || raw.ability !== undefined;
		if (!isFull) {
			// `{ id }` (deprecated in the schema) or a stub with just id/name/image.
			const ref =
				typeof raw.id === 'string' ? raw.id : typeof raw.name === 'string' ? raw.name : '';
			if (!ref) {
				problems.push(error(where, 'This entry has no id. Skipped.'));
				return;
			}
			const character = official(ref, where);
			if (character) add(character, where, false);
			return;
		}
		const character = loadHomebrew(raw, index, where, problems, () => ++customCount);
		if (!character) return;
		if (typeof raw.id === 'string' && raw.id !== character.id) renamedIds[raw.id] = character.id;
		if (data.byId.has(character.id)) {
			problems.push(
				info(where, `Uses the script's own version of ${character.name}, not the official one.`)
			);
		}
		add(character, where, true);
		homebrewJinxes.push(...readHomebrewJinxes(raw, character.id, where, problems));
	});

	const meta = loadMeta(metaRaw, seen, problems);

	if (characters.length === 0) {
		problems.push(error('Script', 'No characters could be loaded from this script.'));
		return { problems, ok: false };
	}
	const seatable = characters.filter((c) => PLAYABLE_TYPES.includes(c.type));
	if (!seatable.some((c) => c.type === 'demon')) {
		problems.push(warn('Script', 'The script has no Demon.'));
	}
	if (homebrew.some((id) => !data.byId.has(id)) && !seen.has('bootlegger')) {
		problems.push(
			info(
				'Script',
				'The script has homebrew characters, so the Bootlegger applies. https://wiki.bloodontheclocktower.com/Bootlegger'
			)
		);
	}

	const script: LoadedScript = {
		name: meta.name ?? '',
		meta,
		characters,
		homebrew,
		homebrewJinxes,
		renamedIds
	};
	return { script, problems, ok: !problems.some((p) => p.severity === 'error') };
}

/** Text fields that should be strings, with the repair for numbers and the like. */
function coerceString(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return undefined;
}

/**
 * Repairs a homebrew character into TPI's shape, then validates it with the same parser as
 * TPI's own data. Only a missing or unknown team, or an id that cannot be made usable,
 * makes the entry unusable; everything else is repaired or dropped with a warning.
 */
function loadHomebrew(
	raw: Json,
	index: number,
	where: string,
	problems: ScriptProblem[],
	nextCustom: () => number
): Character | undefined {
	const fixed: Json = { ...raw };
	const name = coerceString(raw.name)?.trim();

	// Id: TPI ids are lower-case letters and digits; scripts in the wild use underscores,
	// capitals, accents (PG 127, PG 153) or other alphabets (PG 111).
	const rawId = coerceString(raw.id) ?? name ?? '';
	let id = normaliseCharacterId(rawId);
	if (!id) {
		id = `homebrew${nextCustom()}`;
		problems.push(
			warn(
				where,
				rawId
					? `The id “${rawId}” has no Latin letters or digits, so it was given the id “${id}”.`
					: `This character has no id, so it was given the id “${id}”.`
			)
		);
	} else if (id !== rawId) {
		problems.push(info(where, `The id “${rawId}” was read as “${id}”.`));
	}
	fixed.id = id;

	if (!name) {
		fixed.name = id;
		problems.push(warn(where, `This character has no name; showing its id “${id}” instead.`));
	} else fixed.name = name;

	const team = normaliseTeam(raw.team);
	if (!team) {
		problems.push(
			error(
				where,
				raw.team === undefined
					? `${fixed.name} has no character type (team). Skipped.`
					: `${fixed.name} has an unknown character type “${String(raw.team)}” (expected one of: ${TYPE_LIST}). Skipped.`
			)
		);
		return undefined;
	}
	if (raw.team !== team)
		problems.push(info(where, `Character type “${String(raw.team)}” read as “${team}”.`));
	fixed.team = team;

	const ability = coerceString(raw.ability);
	if (ability === undefined) {
		problems.push(warn(where, `${fixed.name} has no ability text.`));
		fixed.ability = '';
	} else fixed.ability = ability;

	for (const key of ['edition', 'flavor', 'firstNightReminder', 'otherNightReminder'] as const) {
		if (raw[key] === undefined || raw[key] === null) {
			delete fixed[key];
			continue;
		}
		const value = coerceString(raw[key]);
		if (value === undefined) {
			problems.push(warn(where, `Ignored ${key}: expected text, found ${describe(raw[key])}.`));
			delete fixed[key];
		} else fixed[key] = value;
	}

	for (const key of ['firstNight', 'otherNight'] as const) {
		const value = raw[key];
		if (value === undefined || value === null) {
			delete fixed[key];
			continue;
		}
		const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
		if (typeof n !== 'number' || !Number.isFinite(n)) {
			problems.push(
				warn(where, `Ignored ${key}: expected a number, found ${JSON.stringify(value)}.`)
			);
			delete fixed[key];
		} else if (n <= 0) {
			// The schema: 0 means the character does not wake that night.
			delete fixed[key];
		} else fixed[key] = n;
	}

	for (const key of ['reminders', 'remindersGlobal'] as const) {
		const value = raw[key];
		if (value === undefined || value === null) {
			delete fixed[key];
		} else if (typeof value === 'string') {
			fixed[key] = value === '' ? [] : [value];
		} else if (Array.isArray(value)) {
			const strings = value.filter((v): v is string => typeof v === 'string');
			if (strings.length !== value.length) {
				problems.push(
					warn(where, `Ignored ${value.length - strings.length} ${key} that were not text.`)
				);
			}
			fixed[key] = strings;
		} else {
			problems.push(warn(where, `Ignored ${key}: expected a list, found ${describe(value)}.`));
			delete fixed[key];
		}
	}

	if (raw.setup === 'true' || raw.setup === 'false') fixed.setup = raw.setup === 'true';
	else if (raw.setup !== undefined && typeof raw.setup !== 'boolean') {
		problems.push(warn(where, `Ignored setup: expected true or false.`));
		delete fixed.setup;
	}
	// Bracketed setup text marks a setup character even if the flag was left out.
	if (fixed.setup === undefined && /\[[^\]]+\]/.test(String(fixed.ability))) fixed.setup = true;

	if (raw.image !== undefined) {
		const images =
			typeof raw.image === 'string' ? [raw.image] : Array.isArray(raw.image) ? raw.image : [];
		const valid = images.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
		if (valid.length !== images.length || images.length === 0) {
			problems.push(warn(where, 'Ignored an icon (image) that was not a link.'));
		}
		if (valid.length === 0) delete fixed.image;
		else fixed.image = typeof raw.image === 'string' ? valid[0] : valid;
	}

	if (raw.special !== undefined) {
		const specials: Special[] = [];
		const items = Array.isArray(raw.special) ? raw.special : [raw.special];
		let dropped = 0;
		items.forEach((item, i) => {
			const issues = new Issues();
			const parsed = parseSpecial(item, `special[${i}]`, issues);
			if (parsed && issues.list.length === 0) specials.push(parsed);
			else dropped++;
		});
		if (dropped > 0) {
			problems.push(
				warn(
					where,
					`Ignored ${dropped} app feature${dropped === 1 ? '' : 's'} (special) this app does not know.`
				)
			);
		}
		fixed.special = specials.map((s) => ({ ...s }));
	}

	const issues = new Issues();
	const character = parseCharacter(fixed, `[${index}]`, issues, {
		strict: false,
		scriptFields: true
	});
	if (!character) {
		// Should not happen after the repairs above; report rather than crash.
		problems.push(
			error(where, `Could not read this character: ${issues.list.join('; ')}. Skipped.`)
		);
		return undefined;
	}
	if (character.ability.length > 250 || character.name.length > 30) {
		problems.push(
			info(where, `${character.name}: name or ability is longer than TPI's tools allow.`)
		);
	}
	return character;
}

function readHomebrewJinxes(
	raw: Json,
	id: CharacterId,
	where: string,
	problems: ScriptProblem[]
): Jinx[] {
	if (raw.jinxes === undefined) return [];
	if (!Array.isArray(raw.jinxes)) {
		problems.push(warn(where, 'Ignored jinxes: expected a list.'));
		return [];
	}
	const out: Jinx[] = [];
	for (const item of raw.jinxes) {
		const other = isObject(item) ? coerceString(item.id) : undefined;
		const reason = isObject(item) ? coerceString(item.reason) : undefined;
		const otherId = other ? normaliseCharacterId(other) : '';
		if (!otherId || reason === undefined) {
			problems.push(warn(where, 'Ignored a jinx without both an id and a reason.'));
			continue;
		}
		out.push({ characters: [id, otherId], reason });
	}
	return out;
}

function loadMeta(
	raw: Json | undefined,
	onScript: ReadonlyMap<CharacterId, string>,
	problems: ScriptProblem[]
): ScriptMeta {
	const where = 'Script details';
	if (!raw) return { name: '' };
	const meta: ScriptMeta = { name: coerceString(raw.name)?.trim() ?? '' };
	for (const key of ['author', 'logo', 'background', 'almanac'] as const) {
		if (raw[key] === undefined || raw[key] === null) continue;
		const value = coerceString(raw[key]);
		if (value === undefined) problems.push(warn(where, `Ignored ${key}: expected text.`));
		else meta[key] = value;
	}
	if (typeof raw.hideTitle === 'boolean') meta.hideTitle = raw.hideTitle;
	if (raw.bootlegger !== undefined) {
		const rules =
			typeof raw.bootlegger === 'string'
				? [raw.bootlegger]
				: Array.isArray(raw.bootlegger)
					? raw.bootlegger.filter((r): r is string => typeof r === 'string')
					: [];
		if (rules.length === 0 && raw.bootlegger !== '') {
			problems.push(
				warn(where, 'Ignored the homebrew rules (bootlegger): expected a list of text.')
			);
		} else meta.bootlegger = rules;
	}
	for (const key of ['firstNight', 'otherNight'] as const) {
		if (raw[key] === undefined) continue;
		if (!Array.isArray(raw[key])) {
			problems.push(warn(where, `Ignored the custom ${nightName(key)} order: expected a list.`));
			continue;
		}
		const order: string[] = [];
		const unknown: string[] = [];
		for (const entry of raw[key] as unknown[]) {
			const id = typeof entry === 'string' ? normaliseCharacterId(entry) : '';
			if (MARKERS.includes(id) || onScript.has(id)) {
				if (!order.includes(id)) order.push(id);
			} else unknown.push(typeof entry === 'string' ? entry : describe(entry));
		}
		if (unknown.length > 0) {
			problems.push(
				warn(
					where,
					`The custom ${nightName(key)} order lists ${unknown.join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not on the script; ignored.`
				)
			);
		}
		meta[key] = order;
	}
	return meta;
}

/**
 * Writes a loaded script back out in TPI's format (for sharing and saving): `_meta`, then
 * official characters as ids and homebrew characters as full objects with `team`.
 */
export function scriptToJson(script: LoadedScript): unknown[] {
	const meta: Json = { id: '_meta', ...script.meta, name: script.meta.name || script.name };
	const homebrew = new Set(script.homebrew);
	const jinxes = new Map<CharacterId, { id: CharacterId; reason: string }[]>();
	for (const {
		characters: [a, b],
		reason
	} of script.homebrewJinxes) {
		jinxes.set(a, [...(jinxes.get(a) ?? []), { id: b, reason }]);
	}
	return [
		meta,
		...script.characters.map((c) => {
			if (!homebrew.has(c.id)) return c.id;
			const { type, special, ...rest } = c;
			const out: Json = { ...rest, team: type };
			if (special.length > 0) out.special = special;
			if (jinxes.has(c.id)) out.jinxes = jinxes.get(c.id);
			return out;
		})
	];
}

function nightName(key: 'firstNight' | 'otherNight'): string {
	return key === 'firstNight' ? 'first night' : 'other nights';
}

/**
 * The engine's `Script` for a loaded script (08-script-loading.md §5.2): official
 * characters by id, homebrew characters (and official ids the script overrides) with their
 * full data, plus homebrew jinxes. The script's display name is kept in `meta.name`.
 */
export function toScript(loaded: LoadedScript): Script {
	const homebrew = new Set(loaded.homebrew);
	const script: Script = {
		meta: { ...loaded.meta, name: loaded.meta.name || loaded.name },
		entries: loaded.characters.map((character) =>
			homebrew.has(character.id)
				? { kind: 'custom', character }
				: { kind: 'official', id: character.id }
		)
	};
	if (loaded.homebrewJinxes.length > 0) script.jinxes = [...loaded.homebrewJinxes];
	return script;
}

/**
 * The reverse of `toScript`, for a saved game's script: official ids are resolved against
 * `data`. Ids `data` no longer knows (a newer build removed them) are left out and returned
 * in `missing`, so the caller can tell the Storyteller instead of failing.
 */
export function fromScript(
	script: Script,
	data: GameData
): { script: LoadedScript; missing: CharacterId[] } {
	const characters: Character[] = [];
	const homebrew: CharacterId[] = [];
	const missing: CharacterId[] = [];
	for (const entry of script.entries) {
		if (entry.kind === 'custom') {
			characters.push(entry.character);
			homebrew.push(entry.character.id);
			continue;
		}
		const character = data.byId.get(entry.id);
		if (character) characters.push(character);
		else missing.push(entry.id);
	}
	const meta: ScriptMeta = { ...script.meta, name: script.meta?.name ?? '' };
	const edition = OFFICIAL_EDITIONS.find((e) => e.name === meta.name && homebrew.length === 0);
	return {
		script: {
			name: meta.name || edition?.name || '',
			meta,
			...(edition ? { edition: edition.id } : {}),
			characters,
			homebrew,
			homebrewJinxes: [...(script.jinxes ?? [])],
			renamedIds: {}
		},
		missing
	};
}
