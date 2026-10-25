/**
 * The characters a night step's info token is shown with, filled in for the Storyteller
 * (Trevor, 2026-10-24: the Harpy's and Cerenovus's "This character selected you" always shows
 * their own token): the `infoTokenCharacters` part of its rules block, read here and used by
 * `rules/info-token-characters.ts` and the night walk-through.
 *
 * Keyed by the info token's id (`info-tokens.ts`), for a token the character's night text
 * names (or its step offers, `offer`):
 * - `characters`: the characters filled in, in order; `self` is the character itself, and
 *   `chosen` the true character of a player the Storyteller taps first (the Dreamer's choice);
 * - `upTo`: how many the card may show in all on this step, when more than the token's own
 *   count (the Cerenovus shows itself, then the madness character);
 * - `others`: what the rest are picked from: `opposite-alignment`, characters of the other
 *   alignment to the chosen one (the Dreamer sees one good and one evil);
 * - `shuffle`: shown to the player in random order, so the true one isn't always first;
 * - `offer`: offered on the step though its night text doesn't name the card.
 *
 * The Storyteller can still change them: a card with room left opens with these picked.
 */
import { MAX_ASKED_CHARACTERS, STANDARD_INFO_TOKENS } from './info-tokens.ts';
import type { CharacterId } from './types.ts';
import { checkKeys, describe, isObject, readEnum, readNumber, type Issues } from './validate.ts';

/** `self`: the character whose step it is; `chosen`: the player the Storyteller taps. */
export type FilledCharacter = 'self' | 'chosen' | CharacterId;

export const INFO_TOKEN_OTHERS = ['opposite-alignment'] as const;

export interface InfoTokenCharacters {
	characters: readonly FilledCharacter[];
	upTo?: number;
	others?: (typeof INFO_TOKEN_OTHERS)[number];
	shuffle?: true;
	offer?: true;
}

export type InfoTokenCharacterRules = Readonly<Record<string, InfoTokenCharacters>>;

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
	const out: Record<string, InfoTokenCharacters> = {};
	for (const [id, entry] of Object.entries(raw)) {
		const at = `${path}.${id}`;
		const count = STANDARD_INFO_TOKENS.find((t) => t.id === id)?.asks?.characters;
		if (count === undefined) {
			issues.add(at, 'not an info token shown with characters');
			continue;
		}
		if (!isObject(entry)) {
			issues.add(at, `expected object, got ${describe(entry)}`);
			continue;
		}
		checkKeys(entry, ['characters', 'upTo', 'others', 'shuffle', 'offer'], at, issues);
		const characters = entry.characters;
		if (
			!Array.isArray(characters) ||
			characters.length === 0 ||
			!characters.every((c): c is string => typeof c === 'string' && c !== '')
		) {
			issues.add(`${at}.characters`, 'expected a list of character ids, "self" or "chosen"');
			continue;
		}
		const upTo = readNumber(entry, 'upTo', at, issues);
		const most = upTo ?? count;
		const others = readEnum(entry, 'others', INFO_TOKEN_OTHERS, at, issues, false);
		const flags: { shuffle?: true; offer?: true } = {};
		for (const flag of ['shuffle', 'offer'] as const) {
			if (entry[flag] === undefined) continue;
			if (entry[flag] === true) flags[flag] = true;
			else issues.add(`${at}.${flag}`, 'expected true');
		}
		const chosen = characters.filter((c) => c === 'chosen').length;
		if (upTo !== undefined && (!Number.isInteger(upTo) || upTo > MAX_ASKED_CHARACTERS)) {
			issues.add(`${at}.upTo`, `expected a whole number up to ${MAX_ASKED_CHARACTERS}`);
		} else if (characters.length > most) {
			issues.add(`${at}.characters`, `more than the ${most} the card shows`);
		} else if (chosen > 1) {
			issues.add(`${at}.characters`, 'one "chosen" at most');
		} else if (others && chosen === 0) {
			issues.add(`${at}.others`, 'needs a "chosen" character to differ from');
		} else
			out[id] = {
				characters,
				...(upTo !== undefined ? { upTo } : {}),
				...(others ? { others } : {}),
				...flags
			};
	}
	return issues.list.length > before ? undefined : out;
}
