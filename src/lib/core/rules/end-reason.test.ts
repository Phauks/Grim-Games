/**
 * How a game was won, for End game and History. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Glossary ("Demon", "Evil": the usual ends)
 * - https://wiki.bloodontheclocktower.com/Saint (executed, its team loses)
 * - https://wiki.bloodontheclocktower.com/Heretic (flips the winner, not how it was won)
 * - https://wiki.bloodontheclocktower.com/Klutz and /Fiddler (decided by public choices the
 *   grimoire doesn't hold, so only End game can say)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import {
	detectedEndReason,
	endCharacters,
	endReasonCharacter,
	isAlternateEnd,
	parseEndReason
} from './end-reason.ts';

const execute =
	(i: number) =>
	(s: string[]): Command => ({ type: 'Execute', seatId: s[i] });

const TB = ['washerwoman', 'chef', 'empath', 'monk', 'saint', 'poisoner', 'imp'];

describe('detectedEndReason', () => {
	it('names the usual end when the Demon dies', () => {
		const { session } = castGame(TB, execute(6));
		expect(detectedEndReason(session.game, characters, 'good')).toBe('demon-dead');
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
	it('lists those on the script or in a seat that can decide the game, in End game order', () => {
		// Trouble Brewing has the Saint and the Mayor; the Klutz is only in a seat.
		const { session } = castGame(['klutz', 'chef', 'saint', 'poisoner', 'imp']);
		expect(endCharacters(session.game, characters)).toEqual(['saint', 'mayor', 'klutz']);
	});

	it('adds a saved reason that is no longer in play', () => {
		const { session } = castGame(TB);
		expect(endCharacters(session.game, characters, 'character:fiddler')).toEqual([
			'saint',
			'mayor',
			'fiddler'
		]);
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
