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
import type { InfoTokenCharacterRules } from '#lib/core/data/info-token-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
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
			return rule.offer && token && !named.includes(token) ? [token] : [];
		}
	);
	return [...named, ...offered];
}

/**
 * What `character`'s step fills in on the info token `tokenId`, which shows up to `count`
 * characters on its own; nothing when its rules say nothing. A `chosen` place is left out of
 * `characterIds` until `withChosen` fills it; a `value` place holds the character entered as
 * that prep value in `prepValues` (the game's), left out until one is entered.
 */
export function filledInfoToken(
	character: Pick<Character, 'id' | 'edition' | 'rules'>,
	tokenId: string,
	count: number,
	prepValues?: Readonly<Record<string, string>>
): FilledInfoToken | undefined {
	const rule = infoTokenCharacterRulesOf(character)?.[tokenId];
	if (!rule) return undefined;
	const chosenAt = rule.characters.indexOf('chosen');
	return {
		characterIds: rule.characters.flatMap((c) => {
			if (c === 'chosen') return [];
			if (c === 'self') return [character.id];
			if (c !== 'value') return [c];
			const entered = rule.value && prepValues?.[prepValueKey(character.id, rule.value)];
			return entered ? [entered] : [];
		}),
		upTo: Math.max(rule.upTo ?? count, rule.characters.length),
		...(chosenAt >= 0 ? { chosenAt } : {}),
		...(rule.others === 'opposite-alignment' ? { othersOpposite: true as const } : {}),
		...(rule.shuffle ? { shuffle: true as const } : {}),
		...(rule.order === 'good-first' ? { goodFirst: true as const } : {})
	};
}

/**
 * `filled` once the player the Storyteller tapped is known: their true character in the
 * `chosen` place, and the alignment the rest are picked from (the other one to theirs, by
 * character type: a good token and an evil one for the Dreamer). With `mustBeFalse` (the
 * Vortox makes the waking Townsfolk's information false,
 * https://wiki.bloodontheclocktower.com/Vortox) the true character is not filled in and the
 * Storyteller picks every character.
 */
export function withChosen(
	filled: FilledInfoToken,
	chosen: Character,
	mustBeFalse = false
): FilledInfoToken {
	if (filled.chosenAt === undefined) return filled;
	if (mustBeFalse) {
		return {
			characterIds: filled.characterIds,
			upTo: filled.upTo,
			...(filled.shuffle ? { shuffle: true as const } : {}),
			...(filled.goodFirst ? { goodFirst: true as const } : {})
		};
	}
	const ids = [...filled.characterIds];
	ids.splice(filled.chosenAt, 0, chosen.id);
	const alignment = defaultAlignment(chosen.type);
	return {
		characterIds: ids,
		upTo: filled.upTo,
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
