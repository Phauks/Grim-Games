/**
 * Reads a game mode from JSON (a shipped mode, or one someone wrote) and lists every
 * problem with its path, so a mode file can be fixed in one go. Character ids are checked
 * against `known` when it is given.
 */
import { isObject } from '#lib/core/data/validate.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { CAMPAIGN_ENDS, GAME_MODE_FORMAT, MODE_PARTS, type GameMode } from './types.ts';

export type ParsedMode = { ok: true; mode: GameMode } | { ok: false; issues: string[] };

/** The `kind` values each behaviour part accepts. */
const KINDS: Partial<Record<(typeof MODE_PARTS)[number], readonly string[]>> = {
	pool: ['script', 'all-characters', 'script-plus-hidden', 'campaign', 'per-town'],
	counts: ['standard', 'per-town'],
	setupModifiers: ['standard', 'only', 'as-chosen'],
	assignment: ['bag', 'draft', 'choose-own'],
	duplicates: ['standard', 'allowed'],
	bluffs: ['standard', 'none'],
	daySteps: ['town-representative', 'spectator-vote'],
	winConditions: ['standard', 'all-towns'],
	betweenGames: ['campaign']
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseGameMode(value: unknown, known?: ReadonlySet<CharacterId>): ParsedMode {
	const issues: string[] = [];
	const add = (path: string, message: string) => issues.push(`${path}: ${message}`);
	if (!isObject(value)) return { ok: false, issues: ['(root): must be an object'] };

	if (value.format !== GAME_MODE_FORMAT) add('format', `must be ${GAME_MODE_FORMAT}`);
	if (typeof value.id !== 'string' || !ID.test(value.id))
		add('id', 'must be lower-case letters, digits and dashes');
	if (typeof value.name !== 'string' || !value.name.trim()) add('name', 'must be a name');
	if (value.about !== undefined && typeof value.about !== 'string') add('about', 'must be text');
	if (!Array.isArray(value.sources) || value.sources.length === 0)
		add('sources', 'must list at least one source');
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
				if (!(MODE_PARTS as readonly unknown[]).includes(p))
					add(`unconfirmed[${i}]`, `unknown part ${String(p)}`);
			});
	}

	const parts = value.parts;
	if (!isObject(parts)) add('parts', 'must be an object');
	else {
		for (const [key, part] of Object.entries(parts)) {
			const path = `parts.${key}`;
			if (!(MODE_PARTS as readonly string[]).includes(key)) {
				add(path, 'unknown part');
				continue;
			}
			const kinds = KINDS[key as keyof typeof KINDS];
			for (const [i, item] of (Array.isArray(part) ? part : [part]).entries()) {
				const at = Array.isArray(part) ? `${path}[${i}]` : path;
				if (!isObject(item)) {
					add(at, 'must be an object');
					continue;
				}
				if (kinds && !kinds.includes(item.kind as string))
					add(`${at}.kind`, `must be one of ${kinds.join(', ')}`);
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
	return issues.length > 0
		? { ok: false, issues }
		: { ok: true, mode: value as unknown as GameMode };
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
