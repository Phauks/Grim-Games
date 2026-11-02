/**
 * Pope: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Pope
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Pope.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { infoPicker } from '#lib/core/rules/night-info.ts';
import { analyseSetup } from '#lib/core/rules/setup.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Pope', () => {
	const character = committedCharacter('pope');

	describe('data (roles.json)', () => {
		it('is a Loric from edition loric', () => {
			expect(character.name).toBe('Pope');
			expect(character.type).toBe('loric');
			expect(character.edition).toBe('loric');
			expect(defaultAlignment(character.type)).toBeUndefined();
		});

		it('changes setup', () => {
			expect(character.setup).toBe(true);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('pope')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has its special app hooks', () => {
			expect(character.special).toEqual([
				{ type: 'selection', name: 'good-duplicate' },
				{ type: 'selection', name: 'evil-duplicate' }
			]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Pope#Examples)', () => {
		const duplicates = (players: number, ids: string[], s: ReturnType<typeof scenario>) =>
			analyseSetup({ players, inPlay: ids.map((id) => s.characters.get(id)!) }).warnings.filter(
				(w) => w.code === 'duplicate'
			);

		it('Example 1: Three Empaths get different neighbour counts', () => {
			// Wiki: "Doug, Ben, and Sarah are all Empaths. Doug learns a “1”. Ben learns a “0”.
			// Sarah learns a “2”."
			// Seats 0, 3 and 6 are the three Empaths, each with their own neighbours.
			const cast = [
				'empath',
				'imp',
				'chef',
				'empath',
				'monk',
				'poisoner',
				'empath',
				'baron',
				'soldier'
			];
			const s = scenario(cast).rule('pope');
			expect(duplicates(9, [...cast, 'pope'], s)).toEqual([]);
			expect(duplicates(9, cast, s)).not.toEqual([]);
			const count = (seat: number) =>
				infoPicker(s.game, s.seat(seat), 'empath', s.characters)!.range?.truth;
			expect([count(0), count(3), count(6)]).toEqual([1, 0, 2]);
		});
		it("Example 2: Drunk thinks they're General while Xaan bluffs", () => {
			// Wiki: "Lewis and Abdallah are Generals. Evin is the Drunk who thinks he is a General.
			// Alex and Julian are Zealots, and Marianna is the Xaan bluffing as a Zealot."
			// Three General tokens (one is the Drunk's) and two Zealots: allowed with the Pope. The
			// Xaan is a Minion, so only bluffs the Zealot.
			const cast = ['general', 'general', 'general', 'zealot', 'zealot', 'xaan', 'imp'];
			const s = scenario(cast).rule('pope').drunk(2);
			const tokens = ['general', 'general', 'drunk', 'zealot', 'zealot', 'xaan', 'imp'];
			expect(duplicates(7, [...tokens, 'pope'], s)).toEqual([]);
			expect(duplicates(7, tokens, s)).not.toEqual([]);
			expect(s.game.seats[s.seat(2)].characterId).toBe('general');
		});
	});
});
