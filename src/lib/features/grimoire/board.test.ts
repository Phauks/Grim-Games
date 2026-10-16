import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { characterLookup, type Seat } from '#lib/core/model/index.ts';
import { deathCauses } from '#lib/core/rules/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { causeLabel, deathCauseOptions, isOrphan, pickerGroups } from './board.ts';

const data = committedGameData();
const tb = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, tb);

function seat(characterId?: string): Seat {
	return {
		seatId: 's',
		characterId,
		dead: false,
		ghostVoteUsed: false,
		overrides: [],
		reminders: []
	};
}

describe('pickerGroups', () => {
	it('offers the script by type, plus every Traveller', () => {
		const groups = pickerGroups(characters, tb, ['townsfolk', 'demon', 'traveller'], false);
		expect(groups.map((g) => g.type)).toEqual(['townsfolk', 'demon', 'traveller']);
		expect(groups[0].characters.map((c) => c.id)).toEqual(
			tb.entries.flatMap((e) =>
				e.kind === 'official' && characters.get(e.id)?.type === 'townsfolk' ? [e.id] : []
			)
		);
		expect(groups[1].characters.map((c) => c.id)).toEqual(['imp']);
		expect(groups[2].characters.some((c) => c.id === 'gunslinger')).toBe(true);
		expect(groups[2].characters.some((c) => c.edition === 'bmr')).toBe(true);
	});
	it('adds characters off the script when asked, after the script ones', () => {
		const demons = pickerGroups(characters, tb, ['demon'], true)[0].characters;
		expect(demons[0].id).toBe('imp');
		expect(demons.some((c) => c.id === 'zombuul')).toBe(true);
	});
});

describe('isOrphan', () => {
	it('flags a character that is not on the script, never a Traveller', () => {
		expect(isOrphan(seat('imp'), tb, characters)).toBe(false);
		expect(isOrphan(seat('zombuul'), tb, characters)).toBe(true);
		expect(isOrphan(seat('gunslinger'), tb, characters)).toBe(false);
		expect(isOrphan(seat(), tb, characters)).toBe(false);
	});
});

describe('deathCauseOptions', () => {
	const options = deathCauses(['slayer', 'imp', 'gambler', 'philosopher', 'virgin'], characters, [
		'gunslinger'
	]);

	it('lists executed and the Demon, the characters that can cause a death, then something else', () => {
		expect(deathCauseOptions(options, characters)).toEqual([
			'execution',
			'demon',
			'slayer',
			'philosopher',
			'virgin',
			'gunslinger',
			'other'
		]);
	});

	it('offers a character that can only kill its own player on that seat only', () => {
		expect(deathCauseOptions(options, characters, 'gambler')).toContain('gambler');
		expect(deathCauseOptions(options, characters, 'slayer')).not.toContain('gambler');
	});
});

describe('causeLabel', () => {
	// https://wiki.bloodontheclocktower.com/Travellers : Travellers are exiled, not executed.
	it('says Exiled for a Traveller', () => {
		expect(causeLabel('execution', characters)).toBe('Executed');
		expect(causeLabel('execution', characters, true)).toBe('Exiled');
	});
});
