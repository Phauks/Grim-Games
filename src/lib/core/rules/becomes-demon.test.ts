/**
 * Becoming the Demon: the Scarlet Woman takes over the dead Demon's character
 * (https://wiki.bloodontheclocktower.com/Scarlet_Woman). The board offers the change when her
 * "Is The Demon" reminder is placed; these pin which Demon it offers, and when it offers none.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { demonToBecome } from './becomes-demon.ts';

const isTheDemon = { characterId: 'scarletwoman', label: 'Is The Demon' };
const dead =
	(i: number) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause: 'execution' });

describe('demonToBecome (https://wiki.bloodontheclocktower.com/Scarlet_Woman)', () => {
	it('offers the Scarlet Woman the Demon who just died', () => {
		// Five alive, the Imp executed: she becomes the Imp.
		const { session, seats } = castGame(
			['chef', 'empath', 'monk', 'mayor', 'scarletwoman', 'imp'],
			dead(5)
		);
		expect(demonToBecome(session.game, seats[4], isTheDemon, characters)).toBe('imp');
	});

	it('prefers a dead Demon to a living one', () => {
		const { session, seats } = castGame(
			['chef', 'empath', 'scarletwoman', 'imp', 'nodashii'],
			dead(4)
		);
		expect(demonToBecome(session.game, seats[2], isTheDemon, characters)).toBe('nodashii');
	});

	it('offers the Demon in play when none is dead yet', () => {
		const { session, seats } = castGame(['chef', 'empath', 'scarletwoman', 'imp']);
		expect(demonToBecome(session.game, seats[2], isTheDemon, characters)).toBe('imp');
	});

	it('offers nothing for other reminders, a Demon already, or no Demon on the board', () => {
		const { session, seats } = castGame(['chef', 'empath', 'scarletwoman', 'imp']);
		const game = session.game;
		expect(
			demonToBecome(game, seats[2], { characterId: 'poisoner', label: 'Poisoned' }, characters)
		).toBeUndefined();
		expect(demonToBecome(game, seats[3], isTheDemon, characters)).toBeUndefined();
		const none = castGame(['chef', 'empath', 'scarletwoman']);
		expect(demonToBecome(none.session.game, none.seats[2], isTheDemon, characters)).toBeUndefined();
	});
});
