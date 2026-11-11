import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { afterDawn, dayNumber } from './night-order.ts';

describe('afterDawn', () => {
	const sheet = committedGameData().nightSheet;

	// https://wiki.bloodontheclocktower.com/Vizier: all players learn who the Vizier is on day 1.
	// https://wiki.bloodontheclocktower.com/Leviathan: everyone knows the Leviathan is in play.
	it('lists TPI’s announcement steps after Dawn', () => {
		expect(afterDawn(sheet, 'first')).toEqual(['leviathan', 'vizier']);
		expect(afterDawn(sheet, 'other')).toEqual(['leviathan']);
	});

	it('is empty when a sheet has no Dawn', () => {
		expect(afterDawn({ firstNight: ['imp'], otherNight: [] }, 'first')).toEqual([]);
	});
});

describe('dayNumber', () => {
	it('counts the days started', () => {
		expect(dayNumber({ pastDays: [] })).toBe(0);
		expect(dayNumber({ pastDays: [{}, {}] })).toBe(2);
	});
});
