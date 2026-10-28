/**
 * "Yes or no" answers for the two players chosen. Each scenario paraphrases the wiki pages
 * it encodes:
 * - https://wiki.bloodontheclocktower.com/Fortune_Teller: yes when either chosen player is
 *   the Demon or the red herring; the Fortune Teller may choose themselves;
 * - https://wiki.bloodontheclocktower.com/Seamstress: yes when both chosen players share an
 *   alignment;
 * - https://wiki.bloodontheclocktower.com/Recluse: may register as the Demon;
 * - https://wiki.bloodontheclocktower.com/Drunk: any information may be given;
 * - https://wiki.bloodontheclocktower.com/Vortox: a Townsfolk's information must be false.
 */
import { describe, expect, it } from 'vitest';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import type { CastStep } from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker } from './picker.ts';
import { yesNoAnswers, yesNoSeats } from './yes-no.ts';

function pickerFor(cast: string[], character: string, ...steps: CastStep[]) {
	const { game, seats } = castGame(cast, ...steps);
	return { game, seats, picker: infoPicker(game, seats[0], character, characters)! };
}

describe('yesNoAnswers', () => {
	it('answers yes for a pair holding the Demon, no otherwise', () => {
		const { game, seats, picker } = pickerFor(
			['fortuneteller', 'chef', 'imp', 'monk', 'poisoner'],
			'fortuneteller'
		);
		expect(yesNoAnswers(game, picker, [seats[1], seats[2]])).toEqual([
			{ yes: true, reason: 'true' }
		]);
		expect(yesNoAnswers(game, picker, [seats[1], seats[3]])).toEqual([
			{ yes: false, reason: 'true' }
		]);
	});

	it('answers yes for the red herring', () => {
		const { game, seats, picker } = pickerFor(
			['fortuneteller', 'chef', 'imp', 'monk', 'poisoner'],
			'fortuneteller',
			(s) => ({
				type: 'AddReminder',
				seatId: s[3],
				reminder: { characterId: 'fortuneteller', label: 'Red Herring' }
			})
		);
		expect(yesNoAnswers(game, picker, [seats[1], seats[3]])).toEqual([
			{ yes: true, reason: 'true' }
		]);
	});

	it('lets the Fortune Teller choose themselves; the Seamstress chooses others', () => {
		const ft = pickerFor(['fortuneteller', 'chef', 'imp'], 'fortuneteller');
		expect(yesNoSeats(ft.game, ft.picker)).toEqual(ft.seats);
		const sm = pickerFor(['seamstress', 'chef', 'imp'], 'seamstress');
		expect(yesNoSeats(sm.game, sm.picker)).toEqual(sm.seats.slice(1));
	});

	it('adds yes for a Recluse who may register as the Demon', () => {
		const { game, seats, picker } = pickerFor(
			['fortuneteller', 'recluse', 'imp', 'monk', 'poisoner'],
			'fortuneteller'
		);
		expect(yesNoAnswers(game, picker, [seats[1], seats[3]])).toEqual([
			{ yes: false, reason: 'true' },
			{ yes: true, reason: 'registers', registered: [seats[1]] }
		]);
	});

	it('allows either answer for a drunk Seamstress, the true one first', () => {
		const { game, seats, picker } = pickerFor(
			['seamstress', 'chef', 'imp', 'monk', 'poisoner'],
			'seamstress',
			(s) => ({
				type: 'AddReminder',
				seatId: s[0],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			})
		);
		expect(yesNoAnswers(game, picker, [seats[1], seats[3]])).toEqual([
			{ yes: true, reason: 'true' },
			{ yes: false, reason: 'unreliable' }
		]);
	});

	it('gives only the false answer under the Vortox', () => {
		const { game, seats, picker } = pickerFor(
			['seamstress', 'chef', 'vortox', 'monk', 'witch'],
			'seamstress'
		);
		expect(yesNoAnswers(game, picker, [seats[1], seats[3]])).toEqual([
			{ yes: false, reason: 'vortox' }
		]);
	});

	it('waits until both players are chosen', () => {
		const { game, seats, picker } = pickerFor(['seamstress', 'chef', 'imp'], 'seamstress');
		expect(yesNoAnswers(game, picker, [seats[1]])).toEqual([]);
	});
});
