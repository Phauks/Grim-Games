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
import {
	filledInfoToken,
	infoTokenCharacterRulesOf,
	shownOrder,
	shuffled,
	stepInfoTokens,
	withChosen
} from './info-token-characters.ts';
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

	it('only fills in a token the character’s own night text names, or its step offers', () => {
		const stray = [...OFFICIAL_RULES].flatMap(([id, rules]) =>
			Object.entries(rules.infoTokenCharacters ?? {}).flatMap(([token, rule]) => {
				const named = (['first', 'other'] as const).some((night) =>
					infoTokensNamedIn(nightTextFor(character(id), night)?.text).some((t) => t.id === token)
				);
				return named || rule.offer ? [] : [`${id}: ${token}`];
			})
		);
		expect(stray).toEqual([]);
	});

	describe('the Dreamer (https://wiki.bloodontheclocktower.com/Dreamer)', () => {
		// The Dreamer learns one good and one evil character, one of which is the chosen
		// player's. TPI's text names no card, so the step offers "This player is" itself.
		const dreamer = character('dreamer');

		it('offers "This player is" though its night text names no card', () => {
			expect(infoTokensNamedIn(nightTextFor(dreamer, 'other')?.text)).toEqual([]);
			expect(
				stepInfoTokens(dreamer, nightTextFor(dreamer, 'other')?.text).map((t) => t.id)
			).toEqual(['this-player-is']);
		});

		it('asks for the chosen player, then picks the other from the opposite alignment', () => {
			const filled = filledInfoToken(dreamer, 'this-player-is', 3)!;
			expect(filled).toEqual({
				characterIds: [],
				upTo: 2,
				chosenAt: 0,
				othersOpposite: true,
				goodFirst: true
			});
			expect(withChosen(filled, character('clockmaker'))).toEqual({
				characterIds: ['clockmaker'],
				upTo: 2,
				goodFirst: true,
				othersAlignment: 'evil'
			});
			expect(withChosen(filled, character('nodashii')).othersAlignment).toBe('good');
		});

		// The player sees the good character on top and the evil one below, whichever is true
		// (Trevor, 2026-10-27).
		it('shows the good character above the evil one, whichever was chosen', () => {
			const typeOf = (id: string) => data.byId.get(id)?.type;
			const filled = filledInfoToken(dreamer, 'this-player-is', 3)!;
			const good = withChosen(filled, character('clockmaker'));
			const evil = withChosen(filled, character('nodashii'));
			expect(shownOrder(good, ['clockmaker', 'nodashii'], typeOf)).toEqual([
				'clockmaker',
				'nodashii'
			]);
			expect(shownOrder(evil, ['nodashii', 'clockmaker'], typeOf)).toEqual([
				'clockmaker',
				'nodashii'
			]);
			expect(shownOrder(evil, ['witch', 'mutant'], typeOf)).toEqual(['mutant', 'witch']);
		});
	});

	it('shuffles a card that shuffles, and keeps a plain card as picked', () => {
		expect(shuffled(['a', 'b'], () => 0)).toEqual(['b', 'a']);
		expect(shuffled(['a', 'b'], () => 0.99)).toEqual(['a', 'b']);
		const typeOf = () => undefined;
		const card = { characterIds: [], upTo: 2 };
		expect(shownOrder({ ...card, shuffle: true }, ['a', 'b'], typeOf, () => 0)).toEqual(['b', 'a']);
		expect(shownOrder(card, ['b', 'a'], typeOf)).toEqual(['b', 'a']);
	});

	it('a step with no rule offers only what its text names', () => {
		expect(stepInfoTokens(character('imp'), 'Show the *YOU ARE* token.').map((t) => t.id)).toEqual([
			'you-are'
		]);
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

	it('reads a chosen player’s character, opposite-alignment others, order and offer', () => {
		const rule = {
			'this-player-is': {
				characters: ['chosen'],
				upTo: 2,
				others: 'opposite-alignment',
				order: 'good-first',
				offer: true
			}
		};
		expect(parse(rule)).toEqual({ rules: { infoTokenCharacters: rule }, issues: [] });
		const card = rule['this-player-is'];
		expect(parse({ 'this-player-is': { ...card, characters: ['self'] } }).issues).toHaveLength(1);
		expect(
			parse({ 'this-player-is': { ...card, characters: ['chosen', 'chosen'] } }).issues
		).toHaveLength(1);
		expect(parse({ 'this-player-is': { ...card, order: 'evil-first' } }).issues).toHaveLength(1);
		expect(parse({ 'this-player-is': { ...card, shuffle: true } }).issues).toHaveLength(1);
		const shuffles = { ...card, order: undefined };
		expect(parse({ 'this-player-is': { ...shuffles, shuffle: true } }).issues).toEqual([]);
		expect(parse({ 'this-player-is': { ...shuffles, shuffle: false } }).issues).toHaveLength(1);
		expect(parse({ 'this-player-is': { ...card, others: 'any' } }).issues).toHaveLength(1);
	});
});
