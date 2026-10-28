/**
 * A Traveller's alignment is the Storyteller's choice and may be made later
 * (https://wiki.bloodontheclocktower.com/Travellers; Trevor, 2026-10-16). Until then the
 * rules treat it as unknown, and the night starts with a step to choose it.
 */
import { describe, expect, it } from 'vitest';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { registrationWorlds } from './ability.ts';
import { withNightInfo } from './night-info.ts';
import type { NightStep } from './night-order.ts';
import {
	TRAVELLER_ALIGNMENT_STEP,
	travellersWithoutAlignment,
	withTravellerAlignmentStep
} from './traveller-alignment.ts';

const dusk: NightStep = {
	id: 'dusk',
	kind: 'marker',
	afterDawn: false,
	placement: 'marker',
	notes: []
};

describe('Traveller alignment', () => {
	it('lists Travellers without an alignment', () => {
		const { game: g, seats } = castGame(['chef', 'imp', 'beggar', 'thief']);
		expect(travellersWithoutAlignment(g, characters)).toEqual([seats[2], seats[3]]);
	});

	it('puts a step before Dusk only while a Traveller has no alignment', () => {
		const { game: g, seats } = castGame(['chef', 'imp', 'beggar']);
		const steps = withTravellerAlignmentStep([dusk], g, characters);
		expect(steps.map((s) => s.id)).toEqual([TRAVELLER_ALIGNMENT_STEP, 'dusk']);
		expect(steps[0].travellers).toEqual([seats[2]]);
		// withNightInfo adds it too, on any night.
		expect(withNightInfo([dusk], g, characters, 'other')[0].id).toBe(TRAVELLER_ALIGNMENT_STEP);

		const set = castGame(['chef', 'imp', 'beggar'], (s) => ({
			type: 'SetAlignment',
			seatId: s[2],
			alignment: 'evil'
		}));
		expect(withTravellerAlignmentStep([dusk], set.game, characters).map((s) => s.id)).toEqual([
			'dusk'
		]);
	});

	it('treats an unset alignment as unknown: neither in the default world, both in others', () => {
		const { game: g, seats } = castGame(['chef', 'imp', 'beggar']);
		const worlds = registrationWorlds(g, characters);
		expect(worlds[0].alignment(seats[2])).toBeUndefined();
		expect(worlds[0].misregistered).toEqual([]);
		expect(worlds.slice(1).map((w) => w.alignment(seats[2]))).toEqual(['good', 'evil']);
		expect(worlds.slice(1).every((w) => w.misregistered.includes(seats[2]))).toBe(true);
	});
});
