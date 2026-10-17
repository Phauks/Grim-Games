/** Whale Buffet's choose-your-own: https://whalebuffet.com/ */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { baseCounts } from '#lib/core/rules/distribution.ts';
import { chooseOptions, dealTypes } from './choose.ts';
import { gameModeById } from './registry.ts';
import { modeCharacters } from './pool.ts';

const data = committedGameData();
const whale = gameModeById('whale-buffet')!;
const characters = modeCharacters(whale, [], data.characters);

describe('dealTypes', () => {
	it('deals exactly the setup counts', () => {
		const types = dealTypes(baseCounts(9), Math.random);
		expect(types).toHaveLength(9);
		expect(types.filter((t) => t === 'outsider')).toHaveLength(2);
		expect(types.filter((t) => t === 'demon')).toHaveLength(1);
	});
});

describe('chooseOptions', () => {
	it('offers a Demon the Summoner, and no Minion', () => {
		const demon = chooseOptions(whale, characters, 'demon').map((c) => c.id);
		const minion = chooseOptions(whale, characters, 'minion').map((c) => c.id);
		expect(demon).toContain('summoner');
		expect(demon).toContain('imp');
		expect(minion).not.toContain('summoner');
		expect(minion).not.toContain('marionette');
	});

	it('leaves out Drunk and Lunatic, and lets two players choose the same character', () => {
		const outsiders = chooseOptions(whale, characters, 'outsider', ['saint']).map((c) => c.id);
		expect(outsiders).not.toContain('drunk');
		expect(outsiders).not.toContain('lunatic');
		expect(outsiders).toContain('saint');
	});

	it('takes a chosen character away when duplicates are not allowed', () => {
		const standard = gameModeById('standard')!;
		const tb = data.characters.filter((c) => c.edition === 'tb');
		expect(chooseOptions(standard, tb, 'townsfolk', ['chef']).map((c) => c.id)).not.toContain(
			'chef'
		);
	});
});
