/**
 * A player bound to the player carrying their token (M15h): they cannot die, by any cause,
 * while that player lives (`protects.whileCarrierAlive`), and they die with them
 * (`gameEnd.aliveWhileDead.whileCarrierAlive`), while sober. The Lleech and its host, marked
 * with its Poisoned, are the official pair (https://wiki.bloodontheclocktower.com/Lleech).
 */
import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { protection } from './ability.ts';
import { gameEnds } from './game-end.ts';

// Seating: Ana Noble, Ben Slayer, Cat Courtier, Dan Chef, Eve Lleech. Ana is the host.
const hosted = () =>
	scenario(['noble', 'slayer', 'courtier', 'chef', 'lleech']).reminder(
		'noble',
		'lleech',
		'Poisoned'
	);
const drunk = () => hosted().reminder('lleech', 'courtier', 'Drunk');

describe('protects whileCarrierAlive', () => {
	it('stops every death of the Lleech while its host lives', () => {
		const s = hosted();
		for (const by of ['demon', 'other', 'execution', 'day'] as const)
			expect(protection(s.game, s.seat('lleech'), s.characters, by)).toMatchObject({
				characterId: 'lleech'
			});
	});

	it('an executed Lleech whose host lives does not die', () => {
		const s = hosted().execute('lleech');
		expect(s.game.seats[s.seat('lleech')].dead).toBeFalsy();
		expect(gameEnds(s.game, s.characters)).toEqual([]);
	});

	it('protects nobody once the host is dead, or before there is one', () => {
		const dead = hosted().dies('noble');
		expect(protection(dead.game, dead.seat('lleech'), dead.characters, 'demon')).toBeUndefined();
		const none = scenario(['noble', 'slayer', 'courtier', 'chef', 'lleech']);
		expect(protection(none.game, none.seat('lleech'), none.characters, 'demon')).toBeUndefined();
	});

	it('stops nothing while the Lleech is drunk', () => {
		const s = drunk();
		expect(protection(s.game, s.seat('lleech'), s.characters, 'execution')).toBeUndefined();
	});
});

describe('dies with the host (gameEnd.aliveWhileDead.whileCarrierAlive)', () => {
	it('the host dying ends the game for good, though the Lleech is not marked dead', () => {
		const s = hosted().execute('noble');
		expect(gameEnds(s.game, s.characters)).toMatchObject([
			{ rule: 'demon-dead', winner: 'good', seats: [s.seat('lleech')] }
		]);
	});

	it('a drunk Lleech lives on past its host, and its execution then ends the game', () => {
		const s = drunk().dies('noble');
		expect(gameEnds(s.game, s.characters)).toEqual([]);
		const executed = s.execute('lleech');
		expect(executed.game.seats[executed.seat('lleech')].dead).toBe(true);
		expect(gameEnds(executed.game, executed.characters)).toMatchObject([
			{ rule: 'demon-dead', winner: 'good' }
		]);
	});
});
