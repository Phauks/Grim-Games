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
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { promptApplies, reminderPrompt } from '#lib/core/rules/reminder-prompts.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
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
			// Wiki: "The Mayor is executed today. That night, the Undertaker is shown the Mayor token."
			const s = scenario(['undertaker', 'mayor', 'imp', 'monk', 'poisoner']).execute('mayor');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'mayor'
			});
		});

		it('Example 2: Drunk executed, shown the Drunk token', () => {
			// Wiki: "The Drunk, who thinks they are the Virgin, is executed today. At night, the
			// Undertaker is shown the Drunk token, because the Undertaker learns a player's true
			// character, as opposed to the one they believe they are."
			const s = scenario(['undertaker', 'virgin', 'imp', 'monk', 'poisoner'])
				.drunk('virgin')
				.execute('virgin');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'drunk'
			});
		});

		it('Example 3: Spy executed after two exiles, shown as the Butler', () => {
			// Wiki: "The Spy is executed. Two Travellers are exiled. That night, the Undertaker is shown
			// the Butler token, because the Spy is registering as the Butler, and because the exiles are
			// not executions."
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
			// Wiki: "Nobody was executed today. That night, the Undertaker does not wake."
			const s = scenario(['undertaker', 'mayor', 'imp', 'monk', 'poisoner']).newDay();
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)?.kind).toBe(
				'none'
			);
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Undertaker#How_to_Run)', () => {
		const cast = ['undertaker', 'mayor', 'imp', 'monk', 'poisoner'];
		const diedToday = { characterId: 'undertaker', label: 'Died Today' };

		it('puts Died Today only on a dead player', () => {
			// Wiki: "If a player dies by execution, put the Undertaker's DIED TODAY reminder token by
			// the dead player's character token."
			const s = scenario(cast).execute('mayor');
			expect(reminderTargetMisses(s.game, diedToday, s.seat('mayor'), s.characters)).toEqual([]);
			expect(reminderTargetMisses(s.game, diedToday, s.seat('monk'), s.characters)).toEqual([
				'life'
			]);
		});

		it('asks to mark the player dead when Died Today goes on a living seat', () => {
			// Wiki: "If a player dies by execution, put the Undertaker's DIED TODAY reminder token by
			// the dead player's character token."
			const prompt = reminderPrompt('Died Today', 'undertaker', scenario(cast).characters);
			expect(prompt).toBe('markDead');
			expect(promptApplies(prompt!, false)).toBe(true);
		});

		it('shows the character marked Died Today when the day log has no execution', () => {
			// Wiki: "Show the character token marked DIED TODAY to the Undertaker."
			const s = scenario(cast).dies('mayor').reminder('mayor', 'undertaker', 'Died Today');
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)).toMatchObject({
				kind: 'character',
				value: 'mayor'
			});
		});

		it('does not count a Died Today left on the board from an earlier day', () => {
			// Wiki: "Each night except the first, if any player died by execution today, wake the
			// Undertaker."
			// Wiki: "Remove the Undertaker's reminder token when convenient."
			const s = scenario(cast).dies('mayor').reminder('mayor', 'undertaker', 'Died Today').newDay();
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)?.kind).toBe(
				'none'
			);
		});

		it('learns nothing when the executed player does not die', () => {
			// Wiki: "In other editions, there may be more than one execution per day (in which case the
			// Storyteller chooses which character to show the Undertaker) or the execution does not
			// cause a death (in which case the Undertaker learns nothing)."
			const s = scenario([...cast, 'pacifist']).do((at) => ({
				type: 'Execute',
				seatId: at.seat('mayor'),
				savedBy: 'pacifist'
			}));
			expect(s.game.seats[s.seat('mayor')].dead).toBe(false);
			expect(nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)?.kind).toBe(
				'none'
			);
		});

		it('offers either executee when two players were executed today', () => {
			// Wiki: "In other editions, there may be more than one execution per day (in which case the
			// Storyteller chooses which character to show the Undertaker) or the execution does not
			// cause a death (in which case the Undertaker learns nothing)."
			const s = scenario(cast).execute('mayor').execute('monk');
			const answer = nightAnswer(s.game, s.seat('undertaker'), 'undertaker', s.characters)!;
			expect(answer).toMatchObject({ kind: 'character', value: 'monk' });
			expect(answer.because).toEqual([s.seat('mayor'), s.seat('monk')]);
			expect(answer.possible).toEqual([
				{ kind: 'character', value: 'monk' },
				{ kind: 'character', value: 'mayor' }
			]);
		});
	});
});
