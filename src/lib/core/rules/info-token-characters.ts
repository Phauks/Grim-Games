/**
 * The characters an info token on a night step is shown with, ready filled in (Trevor,
 * 2026-10-24): the character's `infoTokenCharacters` rule, with `self` read as the
 * character itself and `chosen` as the true character of the player the Storyteller taps
 * (the Dreamer's). The Storyteller can still change them.
 */
import {
	defaultAlignment,
	type Alignment,
	type Character,
	type CharacterId,
	type CharacterType
} from '#lib/core/data/index.ts';
import {
	infoTokensNamedIn,
	STANDARD_INFO_TOKENS,
	type InfoToken
} from '#lib/core/data/info-tokens.ts';
import {
	ruleEntries,
	type InfoTokenCharacterRules,
	type InfoTokenCharacters
} from '#lib/core/data/info-token-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game } from '#lib/core/model/types.ts';
import { prepValueKey } from './day-reminders.ts';

/** The characters filled in, and how many the card may show in all on this step. */
export interface FilledInfoToken {
	characterIds: readonly CharacterId[];
	upTo: number;
	/** A player is tapped first, and their true character goes at this place (`chosen`). */
	chosenAt?: number;
	/** The rest are picked from this alignment's characters (the Dreamer's other token). */
	othersAlignment?: Alignment;
	/** Within `others`: the opposite alignment to the chosen character's. */
	othersOpposite?: true;
	/** Shown to the player in random order. */
	shuffle?: true;
	/** Shown to the player with good characters above evil ones (the Dreamer's). */
	goodFirst?: true;
	/**
	 * Another of the step's cards, shown just before this one, together (`after`: the
	 * Cerenovus's "This character selected you", then "You are mad as").
	 */
	before?: { token: InfoToken; characterIds: readonly CharacterId[] };
}

/** What a step's cards are filled in from, beyond its character's rules. */
export interface FillContext {
	/** The game's prep values, for a `value` place. */
	prepValues?: Readonly<Record<string, string>>;
	/** The game, for a `demon` or `marked` place. */
	game?: Game;
	characters?: CharacterLookup;
	/** The characters the step changed players into tonight, the latest last (`changed`). */
	changed?: readonly CharacterId[];
}

/** One card a night step offers, with what its rules fill in. */
export interface StepCard {
	token: InfoToken;
	filled?: FilledInfoToken;
}

/**
 * A character's `infoTokenCharacters` rule: a homebrew character's own only (its text is its
 * own), else our overlay file's.
 */
export function infoTokenCharacterRulesOf(
	character: Pick<Character, 'id' | 'edition' | 'rules'>
): InfoTokenCharacterRules | undefined {
	if (character.edition === undefined) return character.rules?.infoTokenCharacters;
	return rulesOf(character.id)?.infoTokenCharacters;
}

/**
 * The info tokens a character's step offers: those its night text names, in the order it
 * names them, then those its rules offer though the text doesn't name them (the Dreamer's).
 */
export function stepInfoTokens(
	character: Pick<Character, 'id' | 'edition' | 'rules'>,
	text: string | undefined
): InfoToken[] {
	const named = infoTokensNamedIn(text);
	const offered = Object.entries(infoTokenCharacterRulesOf(character) ?? {}).flatMap(
		([id, rule]) => {
			const token = STANDARD_INFO_TOKENS.find((t) => t.id === id);
			const offers = ruleEntries(rule).some((e) => e.offer);
			return offers && token && !named.includes(token) ? [token] : [];
		}
	);
	return [...named, ...offered];
}

/**
 * The cards a night step offers (`stepInfoTokens`), one per rule entry when a rule lists
 * several (the Snake Charmer's two "You are"), each filled in by `fillCard`. `own` is the
 * step's own rules, which win over its character's for the tokens they name (a player
 * woken to learn a changed character is shown that character).
 */
export function stepInfoCards(
	character: Pick<Character, 'id' | 'edition' | 'rules'>,
	text: string | undefined,
	context: FillContext = {},
	own?: InfoTokenCharacterRules
): StepCard[] {
	const rules: InfoTokenCharacterRules = { ...infoTokenCharacterRulesOf(character), ...own };
	const tokens = stepInfoTokens(character, text);
	const fill = (token: InfoToken, entry: InfoTokenCharacters) =>
		token.asks?.characters ? fillCard(character, entry, token.asks.characters, context) : undefined;
	return tokens.flatMap((token) => {
		const entries = ruleEntries(rules[token.id]);
		if (entries.length === 0) return [{ token }];
		return entries.map((entry) => {
			const filled = fill(token, entry);
			const lead = entry.after ? STANDARD_INFO_TOKENS.find((t) => t.id === entry.after) : undefined;
			const leadEntry = lead ? ruleEntries(rules[lead.id])[0] : undefined;
			const leadFilled = lead && leadEntry ? fill(lead, leadEntry) : undefined;
			return {
				token,
				...(filled
					? {
							filled: lead
								? {
										...filled,
										before: { token: lead, characterIds: leadFilled?.characterIds ?? [] }
									}
								: filled
						}
					: {})
			};
		});
	});
}

/**
 * What `character`'s step fills in on the info token `tokenId`, which shows up to `count`
 * characters on its own; nothing when its rules say nothing. Its first card when its rules
 * list several. A `chosen` place is left out of `characterIds` until `withChosen` fills it; a
 * `value` place holds the character entered as that prep value in `prepValues` (the
 * game's), left out until one is entered.
 */
export function filledInfoToken(
	character: Pick<Character, 'id' | 'edition' | 'rules'>,
	tokenId: string,
	count: number,
	prepValues?: Readonly<Record<string, string>>
): FilledInfoToken | undefined {
	const rule = ruleEntries(infoTokenCharacterRulesOf(character)?.[tokenId])[0];
	return rule ? fillCard(character, rule, count, { prepValues }) : undefined;
}

/** The Demon in play's true character: a living one's first. */
function demonInPlay(game: Game, characters: CharacterLookup): CharacterId | undefined {
	const demons = game.seating.filter((s) => typeOf(game, s, characters) === 'demon');
	const seat = demons.find((s) => !game.seats[s]?.dead) ?? demons[0];
	return seat ? trueCharacter(game, seat, characters) : undefined;
}

/**
 * The character token of the player carrying `character`'s reminder `token`: the ability
 * the Apprentice holds, not the Apprentice they truly are.
 */
function markedBy(game: Game, characterId: CharacterId, token: string): CharacterId | undefined {
	const seat = game.seating.find((s) =>
		game.seats[s]?.reminders.some((r) => r.characterId === characterId && r.label === token)
	);
	return seat ? game.seats[seat]?.characterId : undefined;
}

/** One card's places filled in from `context`; a place nothing fills yet is left out. */
export function fillCard(
	character: Pick<Character, 'id'>,
	rule: InfoTokenCharacters,
	count: number,
	{ prepValues, game, characters, changed }: FillContext = {}
): FilledInfoToken {
	const chosenAt = rule.characters.indexOf('chosen');
	const one = (id: CharacterId | undefined) => (id ? [id] : []);
	return {
		characterIds: rule.characters.flatMap((c): CharacterId[] => {
			switch (c) {
				case 'chosen':
					return [];
				case 'self':
					return [character.id];
				case 'value':
					return one(rule.value && prepValues?.[prepValueKey(character.id, rule.value)]);
				case 'demon':
					return one(game && characters && demonInPlay(game, characters));
				case 'marked':
					return one(game && rule.token && markedBy(game, character.id, rule.token));
				case 'changed':
					return one(changed?.at(-1));
				default:
					return [c];
			}
		}),
		upTo: rule.upTo === 0 ? 0 : Math.max(rule.upTo ?? count, rule.characters.length),
		...(chosenAt >= 0 ? { chosenAt } : {}),
		...(rule.others === 'opposite-alignment' ? { othersOpposite: true as const } : {}),
		...(rule.shuffle ? { shuffle: true as const } : {}),
		...(rule.order === 'good-first' ? { goodFirst: true as const } : {})
	};
}

/**
 * `filled` once the player the Storyteller tapped is known: their true character in the
 * `chosen` place, and the alignment the rest are picked from (the other one to theirs, by
 * character type: a good token and an evil one for the Dreamer).
 */
export function withChosen(filled: FilledInfoToken, chosen: Character): FilledInfoToken {
	if (filled.chosenAt === undefined) return filled;
	const ids = [...filled.characterIds];
	ids.splice(filled.chosenAt, 0, chosen.id);
	const alignment = defaultAlignment(chosen.type);
	return {
		characterIds: ids,
		upTo: filled.upTo,
		...(filled.before ? { before: filled.before } : {}),
		...(filled.shuffle ? { shuffle: true as const } : {}),
		...(filled.goodFirst ? { goodFirst: true as const } : {}),
		...(filled.othersOpposite && alignment
			? { othersAlignment: alignment === 'good' ? ('evil' as const) : ('good' as const) }
			: {})
	};
}

/** `ids` in random order (`random` returns [0, 1)), for a card that shuffles them. */
export function shuffled<T>(ids: readonly T[], random: () => number = Math.random): T[] {
	const out = [...ids];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * The characters `ids` in the order the player sees them on `filled`'s card: random for a
 * card that shuffles; good above evil for one that puts good first (Trevor, 2026-10-27: the
 * Dreamer's good character on top, whichever is true), keeping the order within each; else
 * as picked. `typeOf` gives a character's type (a Traveller's has no alignment and keeps
 * its place among the good).
 */
export function shownOrder(
	filled: FilledInfoToken | undefined,
	ids: readonly CharacterId[],
	typeOf: (id: CharacterId) => CharacterType | undefined,
	random: () => number = Math.random
): CharacterId[] {
	if (filled?.shuffle) return shuffled(ids, random);
	if (!filled?.goodFirst) return [...ids];
	const evil = (id: CharacterId) => {
		const type = typeOf(id);
		return type !== undefined && defaultAlignment(type) === 'evil';
	};
	return [...ids.filter((id) => !evil(id)), ...ids.filter(evil)];
}
