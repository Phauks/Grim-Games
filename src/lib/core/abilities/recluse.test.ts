/**
 * Recluse: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Recluse
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Recluse.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { dayUseDeath } from '#lib/core/rules/day-claims.ts';
import { gameEnds } from '#lib/core/rules/game-end.ts';
import { infoPicker, isAllowed, isTruthful, nightAnswer } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Recluse', () => {
	const character = committedCharacter('recluse');

	describe('data (roles.json)', () => {
		it('is an Outsider from edition tb', () => {
			expect(character.name).toBe('Recluse');
			expect(character.type).toBe('outsider');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual([]);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is not on the night sheet', () => {
			expect(nightSheetPresence('recluse')).toEqual({ firstNight: false, otherNight: false });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Recluse#Examples)', () => {
		it("Example 1: Slayer kills Recluse, thinking it's Imp", () => {
			// The Storyteller may have the Recluse register as the Imp: the Slayer's shot may kill them.
			const s = scenario(['slayer', 'recluse', 'imp', 'chef', 'poisoner']);
			expect(dayUseDeath(s.game, 'slayer', s.seat('recluse'), s.characters)).toBe('maybe');
			const after = s.dies('recluse', 'slayer');
			expect(gameEnds(after.game, after.characters)).toEqual([]);
		});
		it("Example 2: Empath's evil count drops to zero", () => {
			// Beside the Recluse and the Monk, the Empath may learn 1 one night and 0 the next.
			const s = scenario(['empath', 'recluse', 'imp', 'chef', 'monk']);
			const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
			expect(isAllowed(picker, { seats: [], number: 1 })).toBe(true);
			expect(isTruthful(picker, { seats: [], number: 1 })).toBe(false);
			const next = s.newDay();
			const later = infoPicker(next.game, next.seat('empath'), 'empath', next.characters)!;
			expect(isTruthful(later, { seats: [], number: 0 })).toBe(true);
		});
		it('Example 3: Investigator narrows Scarlet Woman to two players', () => {
			// Neither the Recluse nor the Saint is a Minion; the Recluse may register as one.
			const s = scenario(['investigator', 'recluse', 'saint', 'imp', 'poisoner', 'chef', 'monk']);
			const picker = infoPicker(s.game, s.seat('investigator'), 'investigator', s.characters)!;
			const shown = { seats: [s.seat('recluse'), s.seat('saint')], characterId: 'scarletwoman' };
			expect(isAllowed(picker, shown)).toBe(true);
			expect(isTruthful(picker, shown)).toBe(false);
		});
		it('Example 4: Undertaker wrongly learns the Imp died', () => {
			// The executed Recluse may register as a Demon, so the Undertaker may be shown the Imp.
			const s = scenario(['undertaker', 'recluse', 'imp', 'chef', 'poisoner']).execute('recluse');
			const answer = nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)!;
			expect(answer).toMatchObject({
				kind: 'character',
				value: 'recluse',
				misregister: [s.seat('recluse')]
			});
			expect(answer.registrations[0]?.types).toContain('demon');
		});
		it('Example 5: Chef sees zero, sparing a revealing two', () => {
			// Between the Imp and an evil Traveller, the Recluse may register as evil (2), but the
			// Storyteller may give the true answer, 0.
			const s = scenario(['chef', 'imp', 'recluse', 'gunslinger', 'monk']).do((at) => ({
				type: 'SetAlignment',
				seatId: at.seat('gunslinger'),
				alignment: 'evil'
			}));
			const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
			expect(picker.range).toEqual({ truth: 0, possible: [0, 2] });
			expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
		});
	});
});
