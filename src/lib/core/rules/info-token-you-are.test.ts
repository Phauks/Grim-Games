/**
 * Every "You are" card a night step shows, filled in with the right character (Trevor,
 * 2026-11-01: "snake charmer, you are should autopopulate you are snake charmer", and look
 * at every place a "You are" occurs). Each case follows the character's night text (TPI's
 * botc-release roles.json) and the wiki page cited beside it; the rules are data in
 * `data/rules/<id>.json` (`infoTokenCharacters`).
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { ruleEntries } from '#lib/core/data/info-token-rules.ts';
import { infoTokensNamedIn } from '#lib/core/data/info-tokens.ts';
import { stepInfoCards, type FillContext } from './info-token-characters.ts';
import { nightTextFor } from './night-text.ts';
import { SHOWN_OWN_CHARACTER } from './character-changes.ts';

const data = committedGameData();
const character = (id: string) => data.byId.get(id)!;
const W = 'https://wiki.bloodontheclocktower.com/';

/** The cards `id`'s step offers on `night`, as token id and the characters filled in. */
function cards(id: string, night: 'first' | 'other', context: FillContext = {}) {
	return stepInfoCards(character(id), nightTextFor(character(id), night)?.text, context).map(
		(c) => ({ token: c.token.id, ids: c.filled?.characterIds, upTo: c.filled?.upTo })
	);
}

describe('"You are" cards', () => {
	it('every step whose text names "You are" says how it is filled', () => {
		const unfilled = data.characters.flatMap((c) =>
			(['first', 'other'] as const).flatMap((night) => {
				const named = infoTokensNamedIn(nightTextFor(c, night)?.text).some(
					(t) => t.id === 'you-are'
				);
				const rule = OFFICIAL_RULES.get(c.id)?.infoTokenCharacters?.['you-are'];
				return named && ruleEntries(rule).length === 0 ? [`${c.id} (${night})`] : [];
			})
		);
		expect(unfilled).toEqual([]);
	});

	describe(`the Snake Charmer (${W}Snake_Charmer)`, () => {
		// The Snake Charmer learns they are now the Demon; the old Demon learns they are now
		// the Snake Charmer.
		it('shows "You are" twice: the Demon, then the Snake Charmer', () => {
			const s = scenario(['snakecharmer', 'imp', 'chef', 'poisoner', 'empath']);
			expect(cards('snakecharmer', 'other', { game: s.game, characters: s.characters })).toEqual([
				{ token: 'you-are', ids: ['imp'], upTo: 1 },
				{ token: 'you-are', ids: ['snakecharmer'], upTo: 1 }
			]);
		});

		it('still names the Demon once the tokens are swapped', () => {
			const s = scenario(['snakecharmer', 'imp', 'chef', 'poisoner', 'empath']).do((at) => ({
				type: 'SwapCharacters',
				seatId: at.seat('snakecharmer'),
				withSeatId: at.seat('imp')
			}));
			expect(
				cards('snakecharmer', 'other', { game: s.game, characters: s.characters })[0].ids
			).toEqual(['imp']);
		});
	});

	// Trevor (2026-11-02): players draw the Demon token and the Storyteller decides who is the
	// Lunatic, so the real Demon needs no "You are" (https://wiki.bloodontheclocktower.com/Lunatic).
	it('the Lunatic step offers no "You are"', () => {
		expect(cards('lunatic', 'first').map((c) => c.token)).not.toContain('you-are');
	});

	// The Scarlet Woman learns which Demon she has become
	// (https://wiki.bloodontheclocktower.com/Scarlet_Woman).
	it.each([
		['scarletwoman', 'other', ['scarletwoman', 'fanggu', 'chef', 'mutant', 'empath'], 'fanggu']
	] as const)('%s: "You are" shows the Demon in play', (id, night, cast, demon) => {
		const s = scenario([...cast]);
		const card = cards(id, night, { game: s.game, characters: s.characters }).find(
			(c) => c.token === 'you-are'
		);
		expect(card).toEqual({ token: 'you-are', ids: [demon], upTo: 1 });
	});

	it('prefers a living Demon, as when the Scarlet Woman takes over a dead one', () => {
		const s = scenario(['scarletwoman', 'imp', 'chef', 'empath', 'monk'])
			.dies('imp')
			.becomes('scarletwoman', 'imp');
		expect(cards('scarletwoman', 'other', { game: s.game, characters: s.characters })).toEqual([
			{ token: 'you-are', ids: ['imp'], upTo: 1 }
		]);
	});

	// A player whose character the step changes learns the new one: the Pit-Hag's
	// (https://wiki.bloodontheclocktower.com/Pit-Hag), the Engineer's, the Huntsman's Damsel,
	// the Barber's, the Hatter's, the Cacklejack's, the Kazali's, the Summoner's Demon.
	it.each([
		['pithag', 'other'],
		['engineer', 'first'],
		['huntsman', 'other'],
		['barber', 'other'],
		['hatter', 'other'],
		['cacklejack', 'other'],
		['kazali', 'first'],
		['summoner', 'other']
	] as const)('%s: "You are" shows the character the step just made', (id, night) => {
		const you = (changed?: string[]) =>
			cards(id, night, changed ? { changed } : {}).find((c) => c.token === 'you-are');
		expect(you()).toEqual({ token: 'you-are', ids: [], upTo: 1 });
		expect(you(['witch', 'vigormortis'])).toEqual({
			token: 'you-are',
			ids: ['vigormortis'],
			upTo: 1
		});
	});

	// The Apprentice and Alchemist hold another character's token, marked with their own
	// reminder (https://wiki.bloodontheclocktower.com/Apprentice,
	// https://wiki.bloodontheclocktower.com/Alchemist).
	it.each([
		['apprentice', 'Is The Apprentice', 'monk'],
		['alchemist', 'Is The Alchemist', 'poisoner']
	] as const)('%s: "You are" shows the character on the marked player', (id, token, held) => {
		const s = scenario([id, 'imp', 'chef', 'empath', 'monk']);
		const swapped = s.becomes(id, held).reminder(id, id, token);
		expect(cards(id, 'first', { game: s.game, characters: s.characters })).toEqual([
			{ token: 'you-are', ids: [], upTo: 1 }
		]);
		expect(cards(id, 'first', { game: swapped.game, characters: swapped.characters })).toEqual([
			{ token: 'you-are', ids: [held], upTo: 1 }
		]);
	});

	// The Storyteller taps the player woken: a Lord of Typhon neighbour, the Damsel the
	// Huntsman found, the player the Tor shows (https://wiki.bloodontheclocktower.com/Lord_of_Typhon).
	it.each([
		['lordoftyphon', 'first'],
		['damsel', 'other'],
		['tor', 'other']
	] as const)('%s: "You are" asks which player first', (id, night) => {
		const card = stepInfoCards(character(id), nightTextFor(character(id), night)?.text).find(
			(c) => c.token.id === 'you-are'
		);
		expect(card?.filled).toEqual({ characterIds: [], upTo: 1, chosenAt: 0 });
	});

	// Only the alignment changes: the card shows alone, with a thumb signal
	// (https://wiki.bloodontheclocktower.com/Cult_Leader, https://wiki.bloodontheclocktower.com/Mezepheles).
	it.each([
		['cultleader', 'other'],
		['mezepheles', 'other']
	] as const)('%s: "You are" shows alone', (id, night) => {
		expect(cards(id, night).find((c) => c.token === 'you-are')).toEqual({
			token: 'you-are',
			ids: [],
			upTo: 0
		});
	});

	it('a player woken to learn a changed character is shown it, whatever its own rules say', () => {
		const text = 'Wake this player. Show the *YOU ARE* info token, then the Poisoner token.';
		const shown = stepInfoCards(character('poisoner'), text, {}, SHOWN_OWN_CHARACTER);
		expect(shown.map((c) => c.filled?.characterIds)).toEqual([['poisoner']]);
		// The Snake Charmer's own two cards give way to the one the step fills.
		const charmer = stepInfoCards(character('snakecharmer'), text, {}, SHOWN_OWN_CHARACTER);
		expect(charmer.map((c) => c.filled?.characterIds)).toEqual([['snakecharmer']]);
	});
});

describe(`the Cerenovus (${W}Cerenovus)`, () => {
	// Trevor (2026-11-01): "This character selected you" with the Cerenovus, then "You are mad
	// as" with the madness character, shown together.
	it('offers "You are mad as", shown after "This character selected you"', () => {
		const shown = stepInfoCards(
			character('cerenovus'),
			nightTextFor(character('cerenovus'), 'other')?.text
		);
		expect(shown.map((c) => c.token.id)).toEqual(['selected-you', 'mad-as']);
		expect(shown[0].filled).toEqual({ characterIds: ['cerenovus'], upTo: 1 });
		expect(shown[1].filled?.characterIds).toEqual([]);
		expect(shown[1].filled?.before?.token.id).toBe('selected-you');
		expect(shown[1].filled?.before?.characterIds).toEqual(['cerenovus']);
	});
});

describe('reading several cards for one token', () => {
	it('rejects a marked character without its token, and an unknown card shown before', async () => {
		const { parseCharacterRules } = await import('#lib/core/data/character-rules.ts');
		const { Issues } = await import('#lib/core/data/validate.ts');
		const parse = (infoTokenCharacters: unknown) => {
			const issues = new Issues();
			parseCharacterRules({ infoTokenCharacters }, 'rules', issues);
			return issues.list;
		};
		expect(parse({ 'you-are': [{ characters: ['demon'] }, { characters: ['self'] }] })).toEqual([]);
		expect(parse({ 'you-are': { characters: ['marked'] } })).toHaveLength(1);
		expect(parse({ 'you-are': { characters: ['marked'], token: 'Mad' } })).toEqual([]);
		expect(parse({ 'mad-as': { characters: [], after: 'no-such-card' } })).toHaveLength(1);
		expect(parse({ 'you-are': { characters: [], upTo: -1 } })).toHaveLength(1);
	});
});
