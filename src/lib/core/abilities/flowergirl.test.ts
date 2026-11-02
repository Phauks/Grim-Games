/**
 * Flowergirl: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Flowergirl
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Flowergirl.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Quote the example word for word in a `// Wiki: "..."`
 * comment at the top of the test (Trevor, 2026-11-01). When the engine can't pass it yet,
 * write it anyway as `it.fails` and say which gap it waits on.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { unsetMarks } from '#lib/core/rules/day-marks.ts';
import { nightAnswer } from '#lib/core/rules/night-info.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';

describe('Flowergirl', () => {
	const character = committedCharacter('flowergirl');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Flowergirl');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Demon Voted', 'Demon Not Voted']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for other nights only', () => {
			expect(nightSheetPresence('flowergirl')).toEqual({ firstNight: false, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Flowergirl#Examples)', () => {
		const CAST = ['flowergirl', 'chef', 'empath', 'oracle', 'witch', 'nodashii'];

		it('Example 1: One execution, Demon abstained, Flowergirl learns no', () => {
			// Wiki: "There was one nomination today. Lots of players voted, the player was executed, but
			// the Demon did not vote. That night, the Flowergirl learns that the Demon did not vote
			// today."
			// Votes aren't tracked: the Storyteller marks that the Demon did not vote.
			const s = scenario(CAST)
				.nominate('chef', 'witch')
				.execute('witch')
				.do({ type: 'SetDayMark', mark: 'demon-voted', value: false });
			expect(nightAnswer(s.game, s.seat('flowergirl'), 'flowergirl', s.characters)).toMatchObject({
				kind: 'yes-no',
				value: false
			});
		});

		it('Example 2: Demon voted mid-nominations; Flowergirl learns yes', () => {
			// Wiki: "There were three nominations today. The Demon voted during the second nomination.
			// Nobody was executed. That night, the Flowergirl learns that the Demon voted today."
			const s = scenario(CAST)
				.nominate('chef', 'witch')
				.nominate('empath', 'oracle')
				.nominate('oracle', 'chef')
				.do({ type: 'SetDayMark', mark: 'demon-voted', value: true });
			expect(s.game.today.entries.some((e) => e.kind === 'execution')).toBe(false);
			expect(nightAnswer(s.game, s.seat('flowergirl'), 'flowergirl', s.characters)).toMatchObject({
				kind: 'yes-no',
				value: true,
				because: [s.seat('nodashii')]
			});
		});

		it("Example 3: Traveller exiled; Demon's hand stays down", () => {
			// Wiki: "There were no nominations today. A Traveller was exiled, and all players raised their
			// hand to support the exile. That night, the Flowergirl learns that the Demon did not vote
			// today. (Exiles are never affected by abilities.)"
			// The exile's hands don't count, so the exile sets no answer. With no nominations recorded
			// the app can't tell a quiet day from an unrecorded one (Trevor, 2026-10-23), so the
			// Storyteller's "Demon voted" mark gives the answer.
			const s = scenario([...CAST, 'beggar'])
				.do((at) => ({ type: 'SetAlignment', seatId: at.seat('beggar'), alignment: 'good' }))
				.do((at) => ({ type: 'Exile', seatId: at.seat('beggar') }));
			expect(nightAnswer(s.game, s.seat('flowergirl'), 'flowergirl', s.characters)).toMatchObject({
				kind: 'none'
			});
			const marked = s.do(() => ({ type: 'SetDayMark', mark: 'demon-voted', value: false }));
			expect(
				nightAnswer(marked.game, marked.seat('flowergirl'), 'flowergirl', marked.characters)
			).toMatchObject({ kind: 'yes-no', value: false });
		});
	});

	describe('How to Run (https://wiki.bloodontheclocktower.com/Flowergirl#How_to_Run)', () => {
		const CAST = ['flowergirl', 'chef', 'empath', 'oracle', 'witch', 'nodashii'];
		const labels = (s: Scenario) =>
			s.game.seats[s.seat('flowergirl')].reminders
				.filter((r) => r.characterId === 'flowergirl')
				.map((r) => r.label);

		it('each dawn the Flowergirl is marked Demon Not Voted, and Demon Voted comes off', () => {
			// Wiki: "Each dawn, mark the Flowergirl with the DEMON NOT VOTED reminder, and remove the
			// DEMON VOTED reminder, if any."
			const s = scenario(CAST)
				.do({ type: 'SetDayMark', mark: 'demon-voted', value: true })
				.newDay();
			expect(labels(s)).toEqual(['Demon Not Voted']);
		});

		it('when the Demon votes, Demon Voted replaces Demon Not Voted', () => {
			// Wiki: "Each day, if the Demon votes for any execution, replace the DEMON NOT VOTED reminder
			// with the DEMON VOTED reminder."
			const s = scenario(CAST).do({ type: 'SetDayMark', mark: 'demon-voted', value: false });
			expect(labels(s)).toEqual(['Demon Not Voted']);
			const voted = s.do({ type: 'SetDayMark', mark: 'demon-voted', value: true });
			expect(labels(voted)).toEqual(['Demon Voted']);
		});

		it('the token on the Flowergirl gives the answer at night', () => {
			// Wiki: "Each night except the first, wake the Flowergirl. If the Flowergirl is marked DEMON
			// NOT VOTED, shake your head no. If the Flowergirl is marked DEMON VOTED, nod your head yes."
			const s = scenario(CAST).newDay();
			const ask = (at: Scenario) =>
				nightAnswer(at.game, at.seat('flowergirl'), 'flowergirl', at.characters);
			expect(ask(s.do({ type: 'SetDayMark', mark: 'demon-voted', value: false }))).toMatchObject({
				kind: 'yes-no',
				value: false
			});
			expect(ask(s.do({ type: 'SetDayMark', mark: 'demon-voted', value: true }))).toMatchObject({
				kind: 'yes-no',
				value: true
			});
		});

		it('asks the Storyteller whether the Demon voted when nobody marked it', () => {
			// Wiki: "If you forget whether the Demon voted or not, wake the Demon at night and ask by
			// showing them the DID YOU VOTE TODAY? info token."
			const s = scenario(CAST).nominate('chef', 'witch');
			expect(unsetMarks(s.game, s.characters)).toEqual(['demon-voted']);
			expect(nightAnswer(s.game, s.seat('flowergirl'), 'flowergirl', s.characters)).toMatchObject({
				kind: 'none'
			});
		});
	});
});
