/**
 * Evil Twin: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Evil_Twin
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Evil Twin.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker, learnedRoles } from '#lib/core/rules/night-info.ts';
import { shownToSeats } from '#lib/core/rules/shown-to.ts';

describe('Evil Twin', () => {
	const character = committedCharacter('eviltwin');

	describe('data (roles.json)', () => {
		it('is a Minion from edition snv', () => {
			expect(character.name).toBe('Evil Twin');
			expect(character.type).toBe('minion');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('evil');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Twin']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night only', () => {
			expect(nightSheetPresence('eviltwin')).toEqual({ firstNight: true, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	// The twins learn each other: the Evil Twin is shown the good twin's character, and the good
	// twin the Evil Twin's (TPI's night text; Trevor, 2026-11-01: "App does not show the token").
	describe('the twins are shown each other', () => {
		const twins = () =>
			scenario(['chef', 'empath', 'eviltwin', 'imp', 'monk']).reminder(
				'empath',
				'eviltwin',
				'Twin'
			);

		it('shows the Evil Twin the good twin and their character', () => {
			const s = twins();
			const picker = infoPicker(s.game, s.seat('eviltwin'), 'eviltwin', s.characters)!;
			expect(learnedRoles(s.game, picker, s.characters)!.rows[0]).toMatchObject({
				target: s.seat('empath'),
				characterIds: ['empath'],
				marked: true
			});
		});

		it('shows the good twin the Evil Twin', () => {
			const s = twins();
			expect(shownToSeats(s.game, 'eviltwin', s.characters)).toEqual([s.seat('empath')]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Evil_Twin#Examples)', () => {
		it.todo('Example 1: Both twins claim Oracle; game continues');
		it('Example 2: Sage-turned Mutant twin executed; evil wins', () => {
			const s = scenario(['mutant', 'chef', 'empath', 'eviltwin', 'imp'])
				.reminder('mutant', 'eviltwin', 'Twin')
				.execute('mutant');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'marked-executed', winner: 'evil' }
			]);
		});
		it('Example 3: Wrong twin executed; night deaths stop', () => {
			const s = scenario(['artist', 'chef', 'empath', 'eviltwin', 'imp'])
				.reminder('artist', 'eviltwin', 'Twin')
				.execute('imp');
			expect(gameEnds(s.game, s.characters)).toMatchObject([
				{ rule: 'demon-dead', holds: [{ rule: 'marked-alive' }] }
			]);
		});
		it.todo('Example 4: New good twin executed; evil wins');
	});
});
