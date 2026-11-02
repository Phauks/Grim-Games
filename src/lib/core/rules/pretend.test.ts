/**
 * The Storyteller's pretend evil team (M26). With the Atheist in play there are no evil
 * players, and the Storyteller simulates evil characters that are not in play
 * (https://wiki.bloodontheclocktower.com/Atheist). The pretend team lets information fit them.
 */
import { describe, expect, it } from 'vitest';
import { warned } from '#lib/core/model/fixtures.test-support.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { publicProjection } from '#lib/core/sync/public-projection.ts';
import { infoPicker } from './night-info.ts';
import { gameEnds } from './game-end.ts';
import { pretendGame, pretendTeam } from './pretend.ts';

// Seats in a circle: the Atheist, the Empath, the Chef, the Monk.
const cast = ['atheist', 'empath', 'chef', 'monk'];

describe('setting the pretend team', () => {
	it('records and clears a seat’s pretend character', () => {
		const s = scenario(cast).do((at) => ({
			type: 'SetPretend',
			seatId: at.seat('chef'),
			characterId: 'imp'
		}));
		expect(pretendTeam(s.game, s.characters)).toEqual([
			{ seatId: s.seat('chef'), characterId: 'imp' }
		]);
		const cleared = s.do({ type: 'SetPretend', seatId: s.seat('chef') });
		expect(cleared.game.pretend).toBeUndefined();
	});

	it('warns without a character that allows it, or for a character that is not evil', () => {
		const s = scenario(['empath', 'chef', 'monk']);
		expect(
			warned(s.session, s.ctx, { type: 'SetPretend', seatId: s.seat('chef'), characterId: 'imp' })
		).toContain('no-pretend-team');
		const a = scenario(cast);
		expect(
			warned(a.session, a.ctx, {
				type: 'SetPretend',
				seatId: a.seat('chef'),
				characterId: 'washerwoman'
			})
		).toContain('not-pretend-type');
	});

	it('counts for nothing once no character that allows it is in play', () => {
		const s = scenario(cast)
			.do((at) => ({ type: 'SetPretend', seatId: at.seat('chef'), characterId: 'imp' }))
			.do((at) => ({ type: 'AssignCharacter', seatId: at.seat('atheist'), characterId: 'mayor' }));
		expect(pretendTeam(s.game, s.characters)).toEqual([]);
		expect(pretendGame(s.game, s.characters)).toBeUndefined();
	});
});

describe('information that fits the pretend team', () => {
	it('suggests the Empath’s number as if the pretend Imp were evil', () => {
		const s = scenario(cast).do((at) => ({
			type: 'SetPretend',
			seatId: at.seat('chef'),
			characterId: 'imp'
		}));
		const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
		expect(picker.options.map((o) => o.number)).toContain(0);
		expect(picker.pretend?.map((o) => o.number)).toEqual([1]);
		expect(picker.anyAllowed).toBe(true);
	});

	it('has no pretend options without a pretend team', () => {
		const s = scenario(cast);
		expect(infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!.pretend).toBeUndefined();
	});
});

describe('secrecy and the game’s end', () => {
	it('never reaches the players’ phones', () => {
		const s = scenario(cast).do((at) => ({
			type: 'SetPretend',
			seatId: at.seat('chef'),
			characterId: 'imp'
		}));
		expect(JSON.stringify(publicProjection(s.game))).not.toContain('imp');
	});

	it('a dead pretend Demon does not end the game', () => {
		const s = scenario(cast)
			.do((at) => ({ type: 'SetPretend', seatId: at.seat('chef'), characterId: 'imp' }))
			.dies('chef');
		expect(gameEnds(s.game, s.characters)).toEqual([]);
	});
});
