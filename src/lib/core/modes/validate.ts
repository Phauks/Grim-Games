/**
 * Reads a game mode or special rule from JSON (a shipped one, or one someone wrote) and lists
 * every problem with its path, so a file can be fixed in one go. Character ids are checked
 * against `known` when it is given.
 */
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { isObject, Issues } from '#lib/core/data/validate.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { fileKind } from './file-kind.ts';
import { runsSection } from './pool.ts';
import { readSpec } from '#lib/core/data/read-spec.ts';
import { SETUP_SPECS } from './setup-spec.ts';
import {
	FILE_SECTIONS,
	GAME_MODE_FORMAT,
	RULE_SECTIONS,
	SPECIAL_RULE_FORMAT,
	type CombinedSetup,
	type FileSection,
	type GameMode,
	type ModeSection,
	type SpecialRule
} from './types.ts';

export type ParsedMode = { ok: true; mode: GameMode } | { ok: false; issues: string[] };

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A `kind` a file may carry: only a hint, since its parts say what it is (`fileKind`). */
const KIND_HINTS: readonly unknown[] = [undefined, 'game-mode', 'special-rule'];

/**
 * Reads a file as a game mode: it may set any part. A `kind` of special-rule written in it is
 * dropped, since a file read as a mode is one (an older rule file that sets a whole-game part).
 */
export function parseGameMode(value: unknown, known?: ReadonlySet<CharacterId>): ParsedMode {
	if (!isObject(value)) return { ok: false, issues: ['(root): must be an object'] };
	const issues: string[] = [];
	const add = (path: string, message: string) => issues.push(`${path}: ${message}`);
	if (!KIND_HINTS.includes(value.kind)) add('kind', 'must be game-mode or special-rule');
	if (value.format !== GAME_MODE_FORMAT) add('format', `must be ${GAME_MODE_FORMAT}`);
	checkConflicts(value, add);
	checkFile(value, FILE_SECTIONS, add, known);
	const rules = readRules(value, add, known);
	if (issues.length > 0) return { ok: false, issues };
	const mode: Record<string, unknown> = { ...value, ...(rules ? { rules } : {}) };
	if (value.kind === 'special-rule') delete mode.kind;
	return { ok: true, mode: mode as unknown as GameMode };
}

export type ParsedRule = { ok: true; rule: SpecialRule } | { ok: false; issues: string[] };

/** Why a file that sets this part is a game mode, not a special rule (`fileKind`). */
const MODE_ONLY: Partial<Record<ModeSection, string>> = {
	counts:
		'sets up the whole game, so the file is a game mode (a rule changes counts with rules.setupModifier)',
	assignment: 'deals the whole game, so the file is a game mode',
	towns: 'adds towns, so the file is a game mode',
	betweenGames: 'links games, so the file is a game mode'
};

/**
 * Reads a file as a special rule, listing every problem as `parseGameMode` does. A file that
 * sets a whole-game part is a game mode, so each such part is a problem here.
 */
export function parseSpecialRule(value: unknown, known?: ReadonlySet<CharacterId>): ParsedRule {
	if (!isObject(value)) return { ok: false, issues: ['(root): must be an object'] };
	const issues: string[] = [];
	const add = (path: string, message: string) => issues.push(`${path}: ${message}`);
	if (!KIND_HINTS.includes(value.kind)) add('kind', 'must be game-mode or special-rule');
	if (value.format !== SPECIAL_RULE_FORMAT) add('format', `must be ${SPECIAL_RULE_FORMAT}`);
	const parts = isObject(value.setup) ? value.setup : {};
	for (const key of Object.keys(parts)) {
		const reason = MODE_ONLY[key as ModeSection];
		if (reason) add(`setup.${key}`, reason);
	}
	if (isObject(parts.pool) && parts.pool.kind !== 'script-plus-hidden')
		add(
			'setup.pool.kind',
			parts.pool.kind === 'script'
				? 'script is the standard pool; leave pool out'
				: 'replaces the script, so the file is a game mode'
		);
	checkConflicts(value, add);
	checkFile(value, RULE_SECTIONS, add, known);
	const rules = readRules(value, add, known);
	return issues.length > 0
		? { ok: false, issues }
		: {
				ok: true,
				rule: {
					...value,
					...(rules ? { rules } : {}),
					kind: 'special-rule'
				} as unknown as SpecialRule
			};
}

/** Reads any file: a game mode or a special rule, as its parts say (`fileKind`). */
export function parseModeOrRule(
	value: unknown,
	known?: ReadonlySet<CharacterId>
): ParsedMode | ParsedRule {
	return fileKind(value) === 'special-rule'
		? parseSpecialRule(value, known)
		: parseGameMode(value, known);
}

/** `conflictsWith`, for a file of either kind. */
function checkConflicts(
	value: Record<string, unknown>,
	add: (path: string, message: string) => void
) {
	if (value.conflictsWith === undefined) return;
	const c = value.conflictsWith;
	if (!isObject(c) || [c.modes, c.rules].some((l) => l !== undefined && !isTextList(l)))
		add('conflictsWith', 'must list modes and rules by id');
}

const isTextList = (value: unknown): boolean =>
	Array.isArray(value) && value.every((line) => typeof line === 'string');

/** Each problem a reader recorded, added under its own path. */
function addAll(issues: Issues, add: (path: string, message: string) => void) {
	for (const issue of issues.list) {
		const at = issue.indexOf(': ');
		add(issue.slice(0, at), issue.slice(at + 2));
	}
}

/**
 * The file's rules block (`FileRules`), read by the same reader as a character's
 * (`parseCharacterRules`), with each problem added under `rules`. Undefined when it has none.
 */
function readRules(
	value: Record<string, unknown>,
	add: (path: string, message: string) => void,
	known: ReadonlySet<CharacterId> | undefined
) {
	if (value.rules === undefined) return undefined;
	const issues = new Issues();
	const rules = parseCharacterRules(value.rules, 'rules', issues);
	addAll(issues, add);
	if (known)
		for (const [p, id] of characterIds(value.rules, 'rules')) {
			if (!known.has(id)) add(p, `unknown character ${id}`);
		}
	return rules;
}

/** The header and parts both kinds share; `allowed` is the parts this kind may set. */
function checkFile(
	value: Record<string, unknown>,
	allowed: readonly string[],
	add: (path: string, message: string) => void,
	known: ReadonlySet<CharacterId> | undefined
) {
	if (typeof value.id !== 'string' || !ID.test(value.id))
		add('id', 'must be lower-case letters, digits and dashes');
	if (typeof value.name !== 'string' || !value.name.trim()) add('name', 'must be a name');
	if (value.about !== undefined && typeof value.about !== 'string') add('about', 'must be text');
	if (value.revision !== undefined && !Number.isInteger(value.revision))
		add('revision', 'must be a whole number');
	// A mode of one's own may have none (Trevor, 2026-10-19: no notes as a source).
	if (!Array.isArray(value.sources)) add('sources', 'must be a list of links');
	else
		value.sources.forEach((s, i) => {
			if (!isObject(s) || typeof s.title !== 'string' || typeof s.url !== 'string')
				add(`sources[${i}]`, 'must have a title and a url');
			else if (!/^https:\/\//.test(s.url)) add(`sources[${i}].url`, 'must be an https link');
		});
	if (value.authors !== undefined) {
		if (!Array.isArray(value.authors)) add('authors', 'must be a list of links');
		else
			value.authors.forEach((a, i) => {
				if (!isObject(a) || typeof a.title !== 'string' || typeof a.url !== 'string')
					add(`authors[${i}]`, 'must have a name (title) and the url that names them');
				else if (!/^https:\/\//.test(a.url)) add(`authors[${i}].url`, 'must be an https link');
			});
	}
	if (value.unconfirmed !== undefined) {
		if (!Array.isArray(value.unconfirmed)) add('unconfirmed', 'must be a list of parts');
		else
			value.unconfirmed.forEach((p, i) => {
				if (!allowed.includes(p as string))
					add(`unconfirmed[${i}]`, `unknown section ${String(p)}`);
			});
	}

	const setup = value.setup;
	if (!isObject(setup)) {
		add('setup', 'must be an object');
		return;
	}
	for (const [key, raw] of Object.entries(setup)) {
		const path = `setup.${key}`;
		if (!allowed.includes(key)) {
			if (!(key in MODE_ONLY)) add(path, 'unknown section');
			continue;
		}
		const issues = new Issues();
		readSpec(SETUP_SPECS[key as FileSection], raw, path, issues, undefined);
		addAll(issues, add);
		if (known)
			for (const [p, id] of characterIds(raw, path)) {
				if (!known.has(id)) add(p, `unknown character ${id}`);
			}
		if (key === 'assignment' && isObject(raw) && Array.isArray(raw.offers) && !raw.offers.length)
			add(`${path}.offers`, 'must offer at least one character');
		// A rule's plain lines need no instructions: they are its instructions.
		if (key === 'text') continue;
		for (const [i, item] of (Array.isArray(raw) ? raw : [raw]).entries()) {
			const at = Array.isArray(raw) ? `${path}[${i}]` : path;
			if (!isObject(item)) continue;
			if (typeof item.instructions === 'string' && !item.instructions.trim())
				add(`${at}.instructions`, 'must be text');
			else if (
				item.instructions === undefined &&
				!runsSection({ setup: setup as CombinedSetup }, key as ModeSection)
			)
				add(`${at}.instructions`, 'the Storyteller runs this section, so say what they do');
		}
	}
}

/** Fields holding character ids, with their paths. */
const ID_LISTS = [
	'banned',
	'notChoosable',
	'inPlay',
	'onScript',
	'ruleCharacters',
	'characters',
	'together',
	'grants'
];

function characterIds(item: unknown, path: string): [string, CharacterId][] {
	const found: [string, CharacterId][] = [];
	if (!isObject(item)) return found;
	for (const [key, value] of Object.entries(item)) {
		if (ID_LISTS.includes(key) && Array.isArray(value))
			value.forEach((id, i) => typeof id === 'string' && found.push([`${path}.${key}[${i}]`, id]));
		else if (key === 'onlyFor' && Array.isArray(value))
			value.forEach((o, i) => {
				if (isObject(o) && typeof o.characterId === 'string')
					found.push([`${path}.onlyFor[${i}].characterId`, o.characterId]);
			});
		else if (isObject(value)) found.push(...characterIds(value, `${path}.${key}`));
		else if (Array.isArray(value))
			value.forEach((v, i) => found.push(...characterIds(v, `${path}.${key}[${i}]`)));
	}
	return found;
}
