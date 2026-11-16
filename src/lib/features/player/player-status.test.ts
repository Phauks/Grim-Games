import { describe, expect, it } from 'vitest';
import { playerStatus } from './player-status.ts';

const day = { kind: 'day', number: 2 };

describe('playerStatus', () => {
	it('shows where the game is up to when nothing else needs saying', () => {
		expect(playerStatus({ link: 'open', now: day })).toEqual({
			kind: 'phase',
			phase: { kind: 'day', number: 2 }
		});
		expect(playerStatus({ now: { kind: 'setup' } })).toEqual({
			kind: 'phase',
			phase: { kind: 'setup' }
		});
	});

	it('shows nothing before the game reaches the room', () => {
		expect(playerStatus({ link: 'open' })).toEqual({ kind: 'none' });
		expect(playerStatus({ link: 'open', now: { kind: 'day', number: 0 } })).toEqual({
			kind: 'none'
		});
	});

	it('says the phone is offline at any point of the game, over everything else', () => {
		expect(
			playerStatus({ link: 'offline', now: day, character: true, over: { winner: 'good' } })
		).toEqual({ kind: 'offline' });
		expect(playerStatus({ link: 'joining', choosing: true })).toEqual({ kind: 'joining' });
	});

	it('ranks choosing over the ended game, and the ended game over Your character', () => {
		expect(playerStatus({ choosing: true, over: {} })).toEqual({ kind: 'choosing' });
		expect(playerStatus({ over: { winner: 'evil' }, character: true, now: day })).toEqual({
			kind: 'over',
			winner: 'evil'
		});
	});

	it('covers the game with Your character, then with Select seat', () => {
		expect(playerStatus({ character: true, selectSeat: true, now: day })).toEqual({
			kind: 'character'
		});
		expect(playerStatus({ selectSeat: true, now: { kind: 'setup' } })).toEqual({
			kind: 'selectSeat'
		});
	});
});
