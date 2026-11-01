/**
 * Undertaker: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Undertaker
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Undertaker.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

describe('Undertaker', () => {
	const character = committedCharacter('undertaker');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition tb', () => {
			expect(character.name).toBe('Undertaker');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('tb');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Died Today']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('undertaker')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Undertaker#Examples)', () => {
		it('Example 1: Mayor executed, Undertaker shown the Mayor', () => {
			const s = scenario(['undertaker', 'mayor', 'imp', 'monk', 'poisoner']).execute('mayor');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'mayor'
			});
		});

		it('Example 2: Drunk executed, shown the Drunk token', () => {
			// The Undertaker learns the true character, not the Virgin the Drunk thought they were.
			const s = scenario(['undertaker', 'virgin', 'imp', 'monk', 'poisoner'])
				.drunk('virgin')
				.execute('virgin');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'drunk'
			});
		});

		it('Example 3: Spy executed after two exiles, shown as the Butler', () => {
			// Exiles are not executions; the executed Spy may register as an Outsider such as the Butler.
			const s = scenario(['undertaker', 'spy', 'imp', 'monk', 'chef', 'beggar', 'gunslinger'])
				.do(
					(at) => ({ type: 'SetAlignment', seatId: at.seat('beggar'), alignment: 'good' }),
					(at) => ({ type: 'SetAlignment', seatId: at.seat('gunslinger'), alignment: 'good' })
				)
				.do((at) => ({ type: 'Exile', seatId: at.seat('beggar') }))
				.do((at) => ({ type: 'Exile', seatId: at.seat('gunslinger') }))
				.execute('spy');
			const answer = nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)!;
			expect(answer).toMatchObject({ kind: 'character', value: 'spy', because: [s.seat('spy')] });
			// The answer flags the Spy as able to register as an Outsider, so the Butler may be shown.
			expect(answer.misregister).toEqual([s.seat('spy')]);
			expect(answer.registrations[0]?.types).toContain('outsider');
		});

		it('Example 4: nobody executed, Undertaker learns nothing', () => {
			const s = scenario(['undertaker', 'mayor', 'imp', 'monk', 'poisoner']).newDay();
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)?.kind).toBe(
				'none'
			);
		});
	});
});
