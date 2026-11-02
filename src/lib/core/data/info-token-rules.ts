/**
 * The characters a night step's info token is shown with, filled in for the Storyteller
 * (Trevor, 2026-10-24: the Harpy's and Cerenovus's "This character selected you" always shows
 * their own token): the `infoTokenCharacters` part of its rules block, read here and used by
 * `rules/info-token-characters.ts` and the night walk-through.
 *
 * Keyed by the info token's id (`info-tokens.ts`), for a token the character's night text
 * names (or its step offers, `offer`). A list instead of one entry is one card each, in the
 * order the text names them (the Snake Charmer shows "You are" twice: the Demon, then itself).
 * - `characters`: the characters filled in, in order, or none (the card is filled by hand, or
 *   shown alone with `upTo: 0`); `self` is the character itself, `chosen` the true character
 *   of a player the Storyteller taps first (the Dreamer's choice), `value` the character the
 *   Storyteller entered as the prep value named by `value` (the Storm Catcher's named
 *   character, shown as not in play), `demon` the true character of the Demon in play (a
 *   living one first), `marked` the character token of the player carrying this character's
 *   own reminder `token` (the Apprentice's Is The Apprentice), and `changed` the character the
 *   step last changed a player into (the Pit-Hag's new character);
 * - `value`: with a `value` character, the key of that prep value (`setupPrep` note `value`);
 * - `token`: with a `marked` character, the reminder that marks the player;
 * - `after`: another card of this step shown just before this one, together (the Cerenovus's
 *   "This character selected you", then "You are mad as");
 * - `upTo`: how many the card may show in all on this step, when more than the token's own
 *   count (the Cerenovus shows itself, then the madness character);
 * - `others`: what the rest are picked from: `opposite-alignment`, characters of the other
 *   alignment to the chosen one (the Dreamer sees one good and one evil);
 * - `shuffle`: shown to the player in random order, so the true one isn't always first;
 * - `order`: shown to the player in a fixed order instead: `good-first`, good characters
 *   above evil ones, whichever is true (Trevor, 2026-10-27: the Dreamer's);
 * - `offer`: offered on the step though its night text doesn't name the card.
 *
 * The Storyteller can still change them: a card with room left opens with these picked.
 */
import { MAX_ASKED_CHARACTERS, STANDARD_INFO_TOKENS } from './info-tokens.ts';
import type { CharacterId } from './types.ts';
import {
	checkKeys,
	describe,
	isObject,
	readEnum,
	readNumber,
	readString,
	type Issues
} from './validate.ts';

/**
 * `self`: the character whose step it is; `chosen`: the player the Storyteller taps; `value`:
 * the character entered as a prep value; `demon`: the Demon in play; `marked`: the player
 * carrying the character's `token`; `changed`: the character the step last made.
 */
export type FilledCharacter =
	'self' | 'chosen' | 'value' | 'demon' | 'marked' | 'changed' | CharacterId;

const INFO_TOKEN_OTHERS = ['opposite-alignment'] as const;

const INFO_TOKEN_ORDERS = ['good-first'] as const;

export interface InfoTokenCharacters {
	characters: readonly FilledCharacter[];
	upTo?: number;
	others?: (typeof INFO_TOKEN_OTHERS)[number];
	shuffle?: true;
	order?: (typeof INFO_TOKEN_ORDERS)[number];
	offer?: true;
	value?: string;
	token?: string;
	after?: string;
}

/** One card, or one card per entry. */
export type InfoTokenCharacterRule = InfoTokenCharacters | readonly InfoTokenCharacters[];

export type InfoTokenCharacterRules = Readonly<Record<string, InfoTokenCharacterRule>>;

/** A rule's cards, one per entry. */
export const ruleEntries = (
	rule: InfoTokenCharacterRule | undefined
): readonly InfoTokenCharacters[] =>
	rule === undefined ? [] : Array.isArray(rule) ? rule : [rule as InfoTokenCharacters];

/** Reads an `infoTokenCharacters` block. */
export function readInfoTokenCharacters(
	raw: unknown,
	path: string,
	issues: Issues
): InfoTokenCharacterRules | undefined {
	if (!isObject(raw)) {
		issues.add(path, `expected object, got ${describe(raw)}`);
		return undefined;
	}
	const before = issues.list.length;
	const out: Record<string, InfoTokenCharacterRule> = {};
	for (const [id, entry] of Object.entries(raw)) {
		const at = `${path}.${id}`;
		const count = STANDARD_INFO_TOKENS.find((t) => t.id === id)?.asks?.characters;
		if (count === undefined) {
			issues.add(at, 'not an info token shown with characters');
			continue;
		}
		if (Array.isArray(entry)) {
			if (entry.length === 0) {
				issues.add(at, 'expected at least one card');
				continue;
			}
			const cards = entry.map((e: unknown, i) => readEntry(e, `${at}[${i}]`, count, issues));
			if (cards.every((c) => c !== undefined)) out[id] = cards;
		} else {
			const card = readEntry(entry, at, count, issues);
			if (card) out[id] = card;
		}
	}
	return issues.list.length > before ? undefined : out;
}

/** One card of an `infoTokenCharacters` block, for a token that shows up to `count`. */
function readEntry(
	entry: unknown,
	at: string,
	count: number,
	issues: Issues
): InfoTokenCharacters | undefined {
	if (!isObject(entry)) {
		issues.add(at, `expected object, got ${describe(entry)}`);
		return undefined;
	}
	checkKeys(
		entry,
		['characters', 'upTo', 'others', 'shuffle', 'order', 'offer', 'value', 'token', 'after'],
		at,
		issues
	);
	const characters = entry.characters;
	if (
		!Array.isArray(characters) ||
		!characters.every((c): c is string => typeof c === 'string' && c !== '')
	) {
		issues.add(`${at}.characters`, 'expected a list of character ids, "self" or "chosen"');
		return undefined;
	}
	const upTo = readNumber(entry, 'upTo', at, issues);
	const most = upTo ?? count;
	const others = readEnum(entry, 'others', INFO_TOKEN_OTHERS, at, issues, false);
	const order = readEnum(entry, 'order', INFO_TOKEN_ORDERS, at, issues, false);
	const flags: { shuffle?: true; offer?: true } = {};
	for (const flag of ['shuffle', 'offer'] as const) {
		if (entry[flag] === undefined) continue;
		if (entry[flag] === true) flags[flag] = true;
		else issues.add(`${at}.${flag}`, 'expected true');
	}
	const chosen = characters.filter((c) => c === 'chosen').length;
	const value = readString(entry, 'value', at, issues, false);
	const token = readString(entry, 'token', at, issues, false);
	const after = readString(entry, 'after', at, issues, false);
	const usesValue = characters.includes('value');
	const usesMarked = characters.includes('marked');
	if (upTo !== undefined && (!Number.isInteger(upTo) || upTo < 0 || upTo > MAX_ASKED_CHARACTERS)) {
		issues.add(`${at}.upTo`, `expected a whole number up to ${MAX_ASKED_CHARACTERS}`);
	} else if (characters.length > most) {
		issues.add(`${at}.characters`, `more than the ${most} the card shows`);
	} else if (chosen > 1) {
		issues.add(`${at}.characters`, 'one "chosen" at most');
	} else if (others && chosen === 0) {
		issues.add(`${at}.others`, 'needs a "chosen" character to differ from');
	} else if (usesValue !== (value !== undefined)) {
		issues.add(`${at}.value`, 'a "value" character and the value key go together');
	} else if (usesMarked !== (token !== undefined)) {
		issues.add(`${at}.token`, 'a "marked" character and the token key go together');
	} else if (after !== undefined && !STANDARD_INFO_TOKENS.some((t) => t.id === after)) {
		issues.add(`${at}.after`, 'not an info token');
	} else if (order && flags.shuffle) {
		issues.add(`${at}.order`, 'a card shuffles or has an order, not both');
	} else
		return {
			characters,
			...(upTo !== undefined ? { upTo } : {}),
			...(others ? { others } : {}),
			...(order ? { order } : {}),
			...(value !== undefined ? { value } : {}),
			...(token !== undefined ? { token } : {}),
			...(after !== undefined ? { after } : {}),
			...flags
		};
	return undefined;
}
