/**
 * Zenomancer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Zenomancer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Zenomancer.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { takesNote } from '#lib/core/rules/shown-to.ts';
import {
	committedCharacter,
	committedGameData,
	nightSheetPresence
} from '#lib/core/testing/committed-data.ts';

const characters = committedGameData().byId;

describe('Zenomancer', () => {
	const character = committedCharacter('zenomancer');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Zenomancer');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Goal', 'Goal', 'Goal']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('zenomancer')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// Summary: the Storyteller sets each goal and the true info it earns, so the app keeps the
	// goal they typed on that player's Goal reminder and shows it on a "Your goal is" card
	// (Trevor, 2026-10-31).
	describe('goals', () => {
		it('each Goal reminder carries the Storyteller’s words; other reminders don’t', () => {
			expect(takesNote({ characterId: 'zenomancer', label: 'Goal' }, characters)).toBe(true);
			expect(takesNote({ characterId: 'zenomancer', label: 'Other' }, characters)).toBe(false);
			expect(takesNote({ characterId: 'chef', label: 'Goal' }, characters)).toBe(false);
		});

		it('shows the goal on its own card', () => {
			expect(rulesOf('zenomancer', characters)?.infoCard).toBe('goal');
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Zenomancer#Examples)', () => {
		it.todo('Example 1: Pit-Hag converts Witch, learns drunk Sage');
		it.todo('Example 2: Marionette doubt goal works; another goal fails');
		it.todo('Example 3: Pillow theft reveals the Demon');
	});
});
