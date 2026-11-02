/**
 * Two Storytellers (`twoStorytellers`): https://wiki.bloodontheclocktower.com/Knaves. One
 * lies about ability information, the players pick which one they go to, and they may switch
 * once.
 */
import { describe, expect, it } from 'vitest';
import { infoPicker } from './night-info.ts';
import { savantSituation } from './savant.ts';
import {
	storytellerName,
	storytellerVisit,
	switchedPair,
	twoStorytellersBy
} from './storytellers.ts';
import { scenario } from '#lib/core/testing/scenario.ts';

const cast = ['chef', 'poisoner', 'imp', 'empath', 'savant'];

describe('two Storytellers', () => {
	it('needs a rule character with the rule in play', () => {
		const s = scenario(cast);
		expect(twoStorytellersBy(s.game, s.characters)).toBeUndefined();
		expect(twoStorytellersBy(s.rule('knaves').game, s.characters)).toBe('knaves');
	});

	it('the truthful Storyteller gives normal information', () => {
		const s = scenario(cast)
			.rule('knaves')
			.do({ type: 'SetStorytellers', liar: 1 }, (at) => ({
				type: 'SetStorytellerVisit',
				seatId: at.seat('chef'),
				storyteller: 0
			}));
		expect(storytellerVisit(s.game, s.seat('chef'), s.characters)).toEqual({
			storyteller: 0,
			lies: false,
			by: 'knaves'
		});
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		expect(picker.mustBeFalse).toBeUndefined();
	});

	it('the liar can still say anything to a drunk or poisoned player', () => {
		const s = scenario(cast)
			.rule('knaves')
			.poisoned('chef')
			.do({ type: 'SetStorytellers', liar: 1 }, (at) => ({
				type: 'SetStorytellerVisit',
				seatId: at.seat('chef'),
				storyteller: 1
			}));
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		expect(picker).toMatchObject({ unreliable: 'poisoned', anyAllowed: true });
		expect(savantSituation(s.game, s.seat('savant'), s.characters).mode).toBe('one-each');
	});

	it('a Savant who goes to the liar hears two false statements', () => {
		const s = scenario(cast)
			.rule('knaves')
			.do({ type: 'SetStorytellers', liar: 0 }, (at) => ({
				type: 'SetStorytellerVisit',
				seatId: at.seat('savant'),
				storyteller: 0
			}));
		expect(savantSituation(s.game, s.seat('savant'), s.characters)).toMatchObject({
			mode: 'both-false',
			falseBy: 'knaves',
			storyteller: { lies: true }
		});
	});

	it('nothing changes until the Storyteller says who lies', () => {
		const s = scenario(cast)
			.rule('knaves')
			.do((at) => ({ type: 'SetStorytellerVisit', seatId: at.seat('chef'), storyteller: 1 }));
		expect(storytellerVisit(s.game, s.seat('chef'), s.characters)).toEqual({
			storyteller: 1,
			by: 'knaves'
		});
		expect(infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!.mustBeFalse).toBeUndefined();
	});

	it('visits are for one day', () => {
		const s = scenario(cast)
			.rule('knaves')
			.do((at) => ({ type: 'SetStorytellerVisit', seatId: at.seat('chef'), storyteller: 1 }))
			.newDay();
		expect(storytellerVisit(s.game, s.seat('chef'), s.characters)).toBeUndefined();
	});

	it('switching swaps the liar, and a second switch only warns', () => {
		expect(switchedPair({ names: ['Ben', 'Lachlan'], liar: 1 })).toEqual({
			names: ['Ben', 'Lachlan'],
			liar: 0,
			switched: true
		});
		const s = scenario(cast)
			.rule('knaves')
			.do({ type: 'SetStorytellers', liar: 1 }, { type: 'SwitchStorytellers' })
			.do({ type: 'SwitchStorytellers' });
		expect(s.game.storytellerPair).toEqual({ liar: 1, switched: true });
		expect(s.session.log.entries.at(-1)?.warnings?.map((w) => w.code)).toContain(
			'already-switched'
		);
	});

	it('names are optional', () => {
		expect(storytellerName(undefined, 0)).toBeUndefined();
		expect(storytellerName({ names: ['Ben', ' '] }, 1)).toBeUndefined();
		expect(storytellerName({ names: ['Ben', 'Lachlan'] }, 0)).toBe('Ben');
	});
});
