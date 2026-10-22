/**
 * Reads a game mode from JSON (a shipped mode, or one someone wrote) and lists every
 * problem with its path, so a mode file can be fixed in one go. Character ids are checked
 * against `known` when it is given.
 */
import { isObject } from '#lib/core/data/validate.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { SEATED_TYPES } from '#lib/core/rules/distribution.ts';
import { runsPart } from './pool.ts';
import {
	CAMPAIGN_ENDS,
	GAME_MODE_FORMAT,
	MODE_PARTS,
	RULE_PARTS,
	SPECIAL_RULE_FORMAT,
	type CombinedParts,
	type GameMode,
	type ModePart,
	type SpecialRule
} from './types.ts';

export type ParsedMode = { ok: true; mode: GameMode } | { ok: false; issues: string[] };

/** The `kind` values each behaviour part accepts. */
export const KINDS: Partial<Record<(typeof RULE_PARTS)[number] | ModePart, readonly string[]>> = {
	pool: ['script', 'all-characters', 'script-plus-hidden', 'campaign', 'per-town'],
	counts: ['standard', 'per-town'],
	setupModifiers: ['standard', 'only', 'as-chosen'],
	assignment: ['bag', 'draft', 'choose-own'],
	duplicates: ['standard', 'allowed'],
	bluffs: ['standard', 'none'],
	daySteps: ['town-representative', 'spectator-vote'],
	winConditions: ['standard', 'demon-executed', 'all-towns'],
	betweenGames: ['campaign'],
	seats: ['storyteller-seat'],
	deaths: ['private'],
	nightSteps: ['wake']
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The format revision from which a part the Storyteller runs must say how (`instructions`).
 * Older files are read without them, as are a script's own rules, which have no revision.
 */
export const INSTRUCTIONS_FROM_REVISION = 8;

export function parseGameMode(value: unknown, known?: ReadonlySet<CharacterId>): ParsedMode {
	if (!isObject(value)) return { ok: false, issues: ['(root): must be an object'] };
	const issues: string[] = [];
	const add = (path: string, message: string) => issues.push(`${path}: ${message}`);
	if (value.kind !== undefined && value.kind !== 'game-mode') add('kind', 'must be game-mode');
	if (value.format !== GAME_MODE_FORMAT) add('format', `must be ${GAME_MODE_FORMAT}`);
	checkFile(value, MODE_PARTS, add, known);
	return issues.length > 0
		? { ok: false, issues }
		: { ok: true, mode: value as unknown as GameMode };
}

export type ParsedRule = { ok: true; rule: SpecialRule } | { ok: false; issues: string[] };

/** Why a special rule can't set a game mode part: it would replace, not add to, the game. */
const MODE_ONLY: Partial<Record<ModePart, string>> = {
	counts: 'a special rule changes counts with countChanges',
	assignment: 'only a game mode changes how characters are dealt',
	towns: 'only a game mode adds towns',
	betweenGames: 'only a game mode links games'
};

/** Reads a special rule from JSON, listing every problem as `parseGameMode` does. */
export function parseSpecialRule(value: unknown, known?: ReadonlySet<CharacterId>): ParsedRule {
	if (!isObject(value)) return { ok: false, issues: ['(root): must be an object'] };
	const issues: string[] = [];
	const add = (path: string, message: string) => issues.push(`${path}: ${message}`);
	if (value.kind !== 'special-rule') add('kind', 'must be special-rule');
	if (value.format !== SPECIAL_RULE_FORMAT) add('format', `must be ${SPECIAL_RULE_FORMAT}`);
	const parts = isObject(value.parts) ? value.parts : {};
	for (const key of Object.keys(parts)) {
		const reason = MODE_ONLY[key as ModePart];
		if (reason) add(`parts.${key}`, reason);
	}
	if (isObject(parts.pool) && parts.pool.kind !== 'script-plus-hidden')
		add('parts.pool.kind', 'a special rule can only add hidden characters to the script');
	if (parts.text !== undefined && !isTextList(parts.text))
		add('parts.text', 'must be a list of lines');
	if (parts.countChanges !== undefined) checkCountChanges(parts.countChanges, add);
	if (isObject(parts.travellers)) {
		if (!Number.isInteger(parts.travellers.inBag) || (parts.travellers.inBag as number) < 0)
			add('parts.travellers.inBag', 'must be a whole number');
		if (typeof parts.travellers.announced !== 'boolean')
			add('parts.travellers.announced', 'must be true or false');
	}
	if (
		isObject(parts.seats) &&
		(!Number.isInteger(parts.seats.count) || (parts.seats.count as number) < 1)
	)
		add('parts.seats.count', 'must be a whole number of at least 1');
	if (value.conflictsWith !== undefined) {
		const c = value.conflictsWith;
		if (!isObject(c) || [c.modes, c.rules].some((l) => l !== undefined && !isTextList(l)))
			add('conflictsWith', 'must list modes and rules by id');
	}
	checkFile(value, RULE_PARTS, add, known);
	return issues.length > 0
		? { ok: false, issues }
		: { ok: true, rule: value as unknown as SpecialRule };
}

/** Reads either kind of file; one without `kind` is a game mode. */
export function parseModeOrRule(
	value: unknown,
	known?: ReadonlySet<CharacterId>
): ParsedMode | ParsedRule {
	return isObject(value) && value.kind === 'special-rule'
		? parseSpecialRule(value, known)
		: parseGameMode(value, known);
}

const isTextList = (value: unknown): boolean =>
	Array.isArray(value) && value.every((line) => typeof line === 'string');

function checkCountChanges(value: unknown, add: (path: string, message: string) => void) {
	if (!Array.isArray(value)) return add('parts.countChanges', 'must be a list of changes');
	value.forEach((op, i) => {
		const at = `parts.countChanges[${i}]`;
		if (!isObject(op) || !['delta', 'set', 'any'].includes(op.kind as string))
			return add(`${at}.kind`, 'must be one of delta, set, any');
		if (!(SEATED_TYPES as readonly unknown[]).includes(op.type))
			add(`${at}.type`, `must be one of ${SEATED_TYPES.join(', ')}`);
		if (op.kind !== 'any' && op.values !== 'most') {
			const values = op.values;
			if (!Array.isArray(values) || !values.length || values.some((n) => !Number.isInteger(n)))
				add(`${at}.values`, 'must be a list of whole numbers');
		}
	});
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
				if (!allowed.includes(p as string)) add(`unconfirmed[${i}]`, `unknown part ${String(p)}`);
			});
	}

	const parts = value.parts;
	const needsInstructions =
		Number.isInteger(value.revision) && (value.revision as number) >= INSTRUCTIONS_FROM_REVISION;
	if (!isObject(parts)) add('parts', 'must be an object');
	else {
		for (const [key, part] of Object.entries(parts)) {
			const path = `parts.${key}`;
			if (!allowed.includes(key)) {
				if (!(key in MODE_ONLY)) add(path, 'unknown part');
				continue;
			}
			const kinds = KINDS[key as keyof typeof KINDS];
			// Plain lists of lines and count changes are checked by their kind's parser. They need
			// no instructions: a rule's lines are its instructions, and a count change ("+1
			// Demon") says all it does.
			if (key === 'text' || key === 'countChanges') continue;
			for (const [i, item] of (Array.isArray(part) ? part : [part]).entries()) {
				const at = Array.isArray(part) ? `${path}[${i}]` : path;
				if (!isObject(item)) {
					add(at, 'must be an object');
					continue;
				}
				if (kinds && !kinds.includes(item.kind as string))
					add(`${at}.kind`, `must be one of ${kinds.join(', ')}`);
				if (
					item.instructions !== undefined &&
					(typeof item.instructions !== 'string' || !item.instructions.trim())
				)
					add(`${at}.instructions`, 'must be text');
				else if (
					needsInstructions &&
					item.instructions === undefined &&
					!runsPart({ parts: parts as CombinedParts }, key as ModePart)
				)
					add(`${at}.instructions`, 'the Storyteller runs this part, so say what they do');
				if (key === 'betweenGames' && Array.isArray(item.endConditions))
					item.endConditions.forEach((e, n) => {
						if (!(CAMPAIGN_ENDS as readonly unknown[]).includes(e))
							add(`${at}.endConditions[${n}]`, `unknown end condition ${String(e)}`);
					});
				if (key === 'assignment' && item.kind === 'draft') {
					const offers = item.offers;
					if (
						!Array.isArray(offers) ||
						offers.length === 0 ||
						offers.some((n) => !Number.isInteger(n) || (n as number) < 1)
					)
						add(`${at}.offers`, 'must be a list of whole numbers of at least 1');
				}
				if (known)
					for (const [p, id] of characterIds(item, at)) {
						if (!known.has(id)) add(p, `unknown character ${id}`);
					}
			}
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
	}
	return found;
}
