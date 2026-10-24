/**
 * The characters a night step's info token is filled in with (Trevor, 2026-10-24: the Harpy
 * and Cerenovus always show their own token with "This character selected you"). Each
 * character's case is decided from its night text (TPI's botc-release roles.json) and the
 * wiki page cited beside it.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { infoTokensNamedIn } from '#lib/core/data/info-tokens.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { Issues } from '#lib/core/data/validate.ts';
import type { Character } from '#lib/core/data/types.ts';
import { filledInfoToken, infoTokenCharacterRulesOf } from './info-token-characters.ts';
import { nightTextFor } from './night-text.ts';

const data = committedGameData();
const character = (id: string) => data.byId.get(id)!;
const filled = (id: string, token: string, count = 1) =>
	filledInfoToken(character(id), token, count);

const W = 'https://wiki.bloodontheclocktower.com/';

describe('info tokens filled in with the step’s own character', () => {
	// The player learns which character chose them, so the card always shows that character.
	it.each([
		['harpy', `${W}Harpy`],
		['preacher', `${W}Preacher`],
		['exorcist', `${W}Exorcist`],
		['barber', `${W}Barber`],
		['barista', `${W}Barista`],
		['harlot', `${W}Harlot`],
		['duchess', `${W}Duchess`]
	])('%s: "This character selected you" shows itself (%s)', (id) => {
		expect(filled(id, 'selected-you')).toEqual({ characterIds: [id], upTo: 1 });
	});

	// Itself, then one more the Storyteller picks: the Cerenovus's madness character, the
	// Boffin's not-in-play ability.
	it.each([
		['cerenovus', `${W}Cerenovus`],
		['boffin', `${W}Boffin`]
	])('%s: "This character selected you" shows itself and room for one more (%s)', (id) => {
		expect(filled(id, 'selected-you')).toEqual({ characterIds: [id], upTo: 2 });
	});

	// The player becomes, or is shown they are, this very character.
	it.each([
		['imp', `${W}Imp`],
		['fanggu', `${W}Fang_Gu`],
		['farmer', `${W}Farmer`],
		['lilmonsta', `${W}Lil%27_Monsta`],
		['riot', `${W}Riot`]
	])('%s: "You are" shows itself (%s)', (id) => {
		expect(filled(id, 'you-are')).toEqual({ characterIds: [id], upTo: 1 });
	});

	// Another player is shown who this character's player is.
	it.each([
		['nightwatchman', `${W}Nightwatchman`],
		['marionette', `${W}Marionette`],
		['lunatic', `${W}Lunatic`]
	])('%s: "This player is" shows itself (%s)', (id) => {
		expect(filled(id, 'this-player-is', 3)).toEqual({ characterIds: [id], upTo: 3 });
	});

	it('fills nothing in where the character shown changes', () => {
		// https://wiki.bloodontheclocktower.com/Pit-Hag : the new character is the one chosen.
		expect(filled('pithag', 'you-are')).toBeUndefined();
		// https://wiki.bloodontheclocktower.com/Barber : the swapped players' new characters vary.
		expect(filled('barber', 'you-are')).toBeUndefined();
	});

	it('only fills in a token the character’s own night text names', () => {
		const stray = [...OFFICIAL_RULES].flatMap(([id, rules]) =>
			Object.keys(rules.infoTokenCharacters ?? {}).flatMap((token) => {
				const named = (['first', 'other'] as const).some((night) =>
					infoTokensNamedIn(nightTextFor(character(id), night)?.text).some((t) => t.id === token)
				);
				return named ? [] : [`${id}: ${token}`];
			})
		);
		expect(stray).toEqual([]);
	});

	it('reads a homebrew character’s own rule, never the official one it shares an id with', () => {
		const homebrew = {
			...character('harpy'),
			edition: undefined,
			rules: { infoTokenCharacters: { 'you-are': { characters: ['self', 'imp'], upTo: 3 } } }
		} as Character;
		expect(infoTokenCharacterRulesOf(homebrew)).toEqual({
			'you-are': { characters: ['self', 'imp'], upTo: 3 }
		});
		expect(filledInfoToken(homebrew, 'you-are', 1)).toEqual({
			characterIds: ['harpy', 'imp'],
			upTo: 3
		});
		expect(filledInfoToken(homebrew, 'selected-you', 1)).toBeUndefined();
	});
});

describe('reading infoTokenCharacters', () => {
	const parse = (infoTokenCharacters: unknown) => {
		const issues = new Issues();
		const rules = parseCharacterRules({ infoTokenCharacters }, 'rules', issues);
		return { rules, issues: issues.list };
	};

	it('reads characters and a larger count', () => {
		const rule = { 'selected-you': { characters: ['self'], upTo: 2 } };
		expect(parse(rule)).toEqual({ rules: { infoTokenCharacters: rule }, issues: [] });
	});

	it('rejects a card shown without characters, an unknown card, and too many characters', () => {
		expect(parse({ 'this-is-the-demon': { characters: ['self'] } }).issues).toHaveLength(1);
		expect(parse({ 'no-such-card': { characters: ['self'] } }).issues).toHaveLength(1);
		expect(parse({ 'selected-you': { characters: ['self', 'imp'] } }).issues).toHaveLength(1);
		expect(parse({ 'selected-you': { characters: [] } }).issues).toHaveLength(1);
		expect(parse({ 'selected-you': { characters: ['self'], upTo: 9 } }).issues).toHaveLength(1);
		expect(parse({ 'selected-you': { characters: ['self'], more: 1 } }).issues).toHaveLength(1);
	});
});
