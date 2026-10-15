import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { characterLookup, type Seat } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { deathCauseOptions, isOrphan, pickerGroups, seatPosition, tokenSize } from './board.ts';

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

describe('seatPosition', () => {
	it('puts seat 1 at the top and runs clockwise', () => {
		expect(seatPosition(0, 4)).toEqual({ x: 50, y: 9 });
		const second = seatPosition(1, 4);
		expect(second.x).toBeCloseTo(91);
		expect(second.y).toBeCloseTo(50);
	});
});

describe('tokenSize', () => {
	it('stays between a tap target and 96px', () => {
		expect(tokenSize(320, 400, 30)).toBe(44);
		expect(tokenSize(1200, 900, 5)).toBe(96);
		expect(tokenSize(0, 0, 8)).toBe(56);
	});
	it('shrinks as seats are added', () => {
		expect(tokenSize(390, 600, 8)).toBeGreaterThan(tokenSize(390, 600, 12));
	});
});

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
	it('lists executed, the Demon, non-Demon characters in play, then something else', () => {
		expect(deathCauseOptions(characters, ['slayer', 'imp', 'gunslinger', 'slayer'])).toEqual([
			'execution',
			'demon',
			'slayer',
			'gunslinger',
			'other'
		]);
	});
});
