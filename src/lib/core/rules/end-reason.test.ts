/**
 * How a game was won, for End game and History. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Glossary ("Demon", "Evil": the usual ends)
 * - https://wiki.bloodontheclocktower.com/Saint (executed, its team loses)
 * - https://wiki.bloodontheclocktower.com/Heretic (flips the winner, not how it was won)
 * - https://wiki.bloodontheclocktower.com/Klutz and /Fiddler (decided by public choices the
 *   grimoire doesn't hold, so only End game can say)
 * - https://wiki.bloodontheclocktower.com/Slayer (a shot that hits the Demon kills it) and
 *   /Golem (its kill never falls on a Demon)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import {
	detectedEndReason,
	endCharacters,
	endReasonCharacter,
	isAlternateEnd,
	killsDemon,
	parseEndReason
} from './end-reason.ts';

const execute =
	(i: number) =>
	(s: string[]): Command => ({ type: 'Execute', seatId: s[i] });

const dead =
	(i: number, cause: string) =>
	(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true, cause });

const TB = ['washerwoman', 'chef', 'empath', 'monk', 'saint', 'poisoner', 'imp'];

describe('detectedEndReason', () => {
	it('names the usual end when the Demon dies', () => {
		const { session } = castGame(TB, execute(6));
		expect(detectedEndReason(session.game, characters, 'good')).toBe('demon-dead');
	});

	it('names the Slayer when its shot killed the Demon', () => {
		const { session } = castGame(TB, dead(6, 'slayer'));
		expect(detectedEndReason(session.game, characters, 'good')).toBe('character:slayer');
	});

	it('is the Storyteller’s call when the Demon died some other way', () => {
		const { session } = castGame(TB, dead(6, 'other'));
		expect(detectedEndReason(session.game, characters, 'good')).toBe('other');
	});

	it('names the character whose rule gave the winner', () => {
		const { session } = castGame(TB, execute(4));
		expect(detectedEndReason(session.game, characters, 'evil')).toBe('character:saint');
	});

	it('is the Storyteller’s call when no rule gave that winner', () => {
		const { session } = castGame(TB, execute(4));
		expect(detectedEndReason(session.game, characters, 'good')).toBe('other');
	});

	it('keeps the Saint as the reason when the Heretic flips the winner', () => {
		const { session } = castGame(
			[...TB.slice(0, 3), 'heretic', 'saint', 'poisoner', 'imp'],
			execute(4)
		);
		expect(detectedEndReason(session.game, characters, 'good')).toBe('character:saint');
	});
});

describe('endCharacters', () => {
	it('lists those on the script or in a seat that can decide the game, checked ones first', () => {
		// Trouble Brewing has the Saint and the Mayor; the Klutz is only in a seat.
		const { session } = castGame(['klutz', 'chef', 'saint', 'poisoner', 'imp']);
		// The Slayer's shot can kill the Demon.
		expect(endCharacters(session.game, characters)).toEqual(['mayor', 'saint', 'slayer', 'klutz']);
	});

	// https://wiki.bloodontheclocktower.com/Politician: the Storyteller judges who was most
	// responsible for their team losing, so it is offered and never checked.
	it('offers the Politician in play as a reason', () => {
		const { session } = castGame(['politician', 'chef', 'poisoner', 'imp']);
		expect(endCharacters(session.game, characters)).toContain('politician');
	});

	it('adds a saved reason that is no longer in play', () => {
		const { session } = castGame(TB);
		expect(endCharacters(session.game, characters, 'character:fiddler')).toEqual([
			'mayor',
			'saint',
			'slayer',
			'fiddler'
		]);
	});
});

describe('killsDemon', () => {
	it('is an ability whose kill can fall on a Demon, not a Minion’s or Demon’s', () => {
		expect(killsDemon('slayer', characters)).toBe(true);
		expect(killsDemon('gunslinger', characters)).toBe(true);
		expect(killsDemon('golem', characters)).toBe(false);
		expect(killsDemon('assassin', characters)).toBe(false);
		expect(killsDemon('imp', characters)).toBe(false);
		expect(killsDemon('chef', characters)).toBe(false);
	});
});

describe('end reasons', () => {
	it('counts only a character’s own win condition as an alternate end', () => {
		expect(isAlternateEnd('character:klutz')).toBe(true);
		expect(isAlternateEnd('demon-dead')).toBe(false);
		expect(isAlternateEnd('two-alive')).toBe(false);
		expect(isAlternateEnd('other')).toBe(false);
		expect(isAlternateEnd(undefined)).toBe(false);
		expect(endReasonCharacter('character:mayor')).toBe('mayor');
	});

	it('reads saved reasons, dropping unknown ones', () => {
		expect(parseEndReason('two-alive')).toBe('two-alive');
		expect(parseEndReason('character:goblin')).toBe('character:goblin');
		expect(parseEndReason('character:')).toBeUndefined();
		expect(parseEndReason('saint')).toBeUndefined();
		expect(parseEndReason(3)).toBeUndefined();
	});
});
