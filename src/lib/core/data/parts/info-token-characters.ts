import {
	byKey,
	list,
	NUM,
	obj,
	oneOf,
	opt,
	STR,
	STRS,
	T,
	TOKEN,
	variants,
	worded,
	type SpecValue
} from '../field-spec.ts';
import { MAX_ASKED_CHARACTERS, STANDARD_INFO_TOKENS } from '../info-tokens.ts';
import { readSpec } from '../read-spec.ts';
import type { CharacterId } from '../types.ts';
import type { Issues } from '../validate.ts';
import { specPart } from './part.ts';

/**
 * `self`: the character whose step it is; `chosen`: the player the Storyteller taps; `value`:
 * the character entered as a prep value; `demon`: the Demon in play; `marked`: the player
 * carrying the character's `token`; `changed`: the character the step last made; `given`: the
 * ability the character gave a player; `mad`: who the player carrying `token` is mad as.
 */
export type FilledCharacter =
	'self' | 'chosen' | 'value' | 'demon' | 'marked' | 'mad' | 'changed' | 'given' | CharacterId;

const CARD = obj({
	characters: STRS,
	upTo: opt(NUM),
	others: opt(oneOf(['opposite-alignment'])),
	shuffle: opt(T),
	order: opt(oneOf(['good-first'])),
	offer: opt(T),
	omit: opt(T),
	value: opt(STR),
	token: opt(TOKEN),
	after: opt(
		worded(
			{ names: Object.fromEntries(STANDARD_INFO_TOKENS.map((t) => [t.id, t.text])) },
			oneOf(STANDARD_INFO_TOKENS.map((t) => t.id))
		)
	)
});

const SPEC = byKey(
	variants(
		{ label: 'One step', is: 'object', spec: CARD },
		{ label: 'Several steps', is: 'array', spec: list(CARD) }
	)
);

export type InfoTokenCharacters = Omit<SpecValue<typeof CARD>, 'characters'> & {
	characters: readonly FilledCharacter[];
};

/** One card, or one card per entry. */
export type InfoTokenCharacterRule = InfoTokenCharacters | readonly InfoTokenCharacters[];

export type InfoTokenCharacterRules = Readonly<Record<string, InfoTokenCharacterRule>>;

/** A rule's cards, one per entry. */
export const ruleEntries = (
	rule: InfoTokenCharacterRule | undefined
): readonly InfoTokenCharacters[] =>
	rule === undefined ? [] : Array.isArray(rule) ? rule : [rule as InfoTokenCharacters];

/** What a card's settings must agree on, for a token that shows up to `count`; the first problem. */
function cardProblem(
	card: SpecValue<typeof CARD>,
	count: number
): [key: string, problem: string] | undefined {
	const { characters, upTo, others, value, token, order, shuffle } = card;
	const most = upTo ?? count;
	const chosen = characters.filter((c) => c === 'chosen').length;
	const usesValue = characters.includes('value');
	const usesMarked = characters.includes('marked') || characters.includes('mad');
	if (characters.includes(''))
		return ['characters', 'expected a list of character ids, "self" or "chosen"'];
	if (upTo !== undefined && upTo > MAX_ASKED_CHARACTERS)
		return ['upTo', `expected a whole number up to ${MAX_ASKED_CHARACTERS}`];
	if (count === 0 && upTo !== undefined) return ['upTo', 'the card shows no characters'];
	if (characters.length > most) return ['characters', `more than the ${most} the card shows`];
	if (chosen > 1) return ['characters', 'one "chosen" at most'];
	if (others && chosen === 0) return ['others', 'needs a "chosen" character to differ from'];
	if (usesValue !== (value !== undefined))
		return ['value', 'a "value" character and the value key go together'];
	if (usesMarked !== (token !== undefined))
		return ['token', 'a "marked" or "mad" character and the token key go together'];
	if (order && shuffle) return ['order', 'a card shuffles or has an order, not both'];
	return undefined;
}

/** Checks each card against its info token; keys must be info tokens. */
function checkCards(
	value: SpecValue<typeof SPEC>,
	path: string,
	issues: Issues
): InfoTokenCharacterRules | undefined {
	const before = issues.list.length;
	for (const [id, entry] of Object.entries(value)) {
		const at = `${path}.${id}`;
		const info = STANDARD_INFO_TOKENS.find((t) => t.id === id);
		if (!info) {
			issues.add(at, 'not an info token');
			continue;
		}
		// A card shown without characters takes only `characters: []` (offered or left out).
		const count = info.asks?.characters ?? 0;
		if (Array.isArray(entry) && entry.length === 0) issues.add(at, 'expected at least one card');
		const cards = Array.isArray(entry)
			? entry.map((c, i) => [c, `${at}[${i}]`] as const)
			: [[entry, at] as const];
		for (const [card, where] of cards) {
			const problem = cardProblem(card, count);
			if (problem) issues.add(`${where}.${problem[0]}`, problem[1]);
		}
	}
	return issues.list.length > before ? undefined : (value as InfoTokenCharacterRules);
}

/** Reads an `infoTokenCharacters` block, as a rule or a night override's fills. */
export function readInfoTokenCharacters(
	raw: unknown,
	path: string,
	issues: Issues
): InfoTokenCharacterRules | undefined {
	const value = readSpec(SPEC, raw, path, issues, undefined);
	return value && checkCards(value, path, issues);
}

/**
 * The characters a night step's info token is shown with, filled in for the Storyteller
 * (Trevor, 2026-10-24: the Harpy's and Cerenovus's "This character selected you" always shows
 * their own token), used by `rules/night/info-token-characters.ts` and the night walk-through.
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
 *   own reminder `token` (the Apprentice's Is The Apprentice), `changed` the character the
 *   step last changed a player into (the Pit-Hag's new character), and `given` the character
 *   whose ability this character's `givesAbility` gave a player (the Boffin's good character),
 *   and `mad` the character the player carrying this character's own reminder `token` is mad
 *   as (`madAs` on it: the Cerenovus's chosen character);
 * - `value`: with a `value` character, the key of that prep value (`setupPrep` note `value`);
 * - `token`: with a `marked` or `mad` character, the reminder that marks the player;
 * - `after`: another card of this step shown just before this one, together (the Cerenovus's
 *   "This character selected you", then "You are mad as");
 * - `upTo`: how many the card may show in all on this step, when more than the token's own
 *   count (the Cerenovus shows itself, then the madness character);
 * - `others`: what the rest are picked from: `opposite-alignment`, characters of the other
 *   alignment to the chosen one (the Dreamer sees one good and one evil);
 * - `shuffle`: shown to the player in random order, so the true one isn't always first;
 * - `order`: shown to the player in a fixed order instead: `good-first`, good characters
 *   above evil ones, whichever is true (Trevor, 2026-10-27: the Dreamer's);
 * - `offer`: offered on the step though its night text doesn't name the card;
 * - `omit`: not offered though the night text names it (Trevor, 2026-11-02: the Lunatic's
 *   real Demon needs no "You are": players draw the Demon token, and the Storyteller decides
 *   who is the Lunatic).
 *
 * The Storyteller can still change them: a card with room left opens with these picked.
 */
export const infoTokenCharacters = specPart(
	'Info token characters',
	'The characters its night step’s info tokens show, filled in.',
	SPEC,
	checkCards
);
