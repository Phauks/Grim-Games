import { describe, expect, it } from 'vitest';
import type { Character, GameData } from '#lib/core/data/index.ts';
import { botcCard, looseId } from './botcscripts-cards.ts';

const character = (id: string, name: string, type: Character['type']) =>
	({ id, name, type }) as Character;
const data = {
	characters: [
		character('chef', 'Chef', 'townsfolk'),
		character('fortuneteller', 'Fortune Teller', 'townsfolk'),
		character('drunk', 'Drunk', 'outsider'),
		character('poisoner', 'Poisoner', 'minion'),
		character('imp', 'Imp', 'demon'),
		character('po', 'Po', 'demon')
	]
} as unknown as GameData;

describe('BotC Scripts cards', () => {
	it('matches ids the way the site stores them', () => {
		expect(looseId('Fortune_Teller')).toBe('fortuneteller');
	});

	it('counts each type, lists the Demons and keeps type order', () => {
		const card = botcCard(
			[{ id: 'imp' }, { id: 'chef' }, { id: 'fortune_teller' }, { id: 'drunk' }, { id: 'po' }],
			data
		);
		expect(card.counts).toEqual({ townsfolk: 2, outsider: 1, demon: 2 });
		expect(card.demons.map((d) => d.name)).toEqual(['Imp', 'Po']);
		expect(card.groups.map((g) => g.type)).toEqual(['townsfolk', 'outsider', 'demon']);
		expect(card.homebrew).toBe(false);
	});

	it('lists a character once when the script repeats it or spells its id two ways', () => {
		const card = botcCard([{ id: 'fortuneteller' }, { id: 'fortune_teller' }, { id: 'imp' }], data);
		expect(card.groups.flatMap((g) => g.characters.map((c) => c.id))).toEqual([
			'fortuneteller',
			'imp'
		]);
	});

	it('uses a homebrew character’s own name and team, and marks the script', () => {
		const card = botcCard(
			[{ id: 'stormwarden', name: 'Storm Warden', team: 'townsfolk' }, { id: 'mystery' }],
			data
		);
		expect(card.homebrew).toBe(true);
		expect(card.counts).toEqual({ townsfolk: 1 });
		expect(card.groups.at(-1)).toEqual({
			type: undefined,
			characters: [{ id: 'mystery', name: 'mystery', type: undefined }]
		});
	});
});
