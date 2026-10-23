/**
 * Godfather: "Each night (except the first), if an Outsider died today, choose a player: they
 * die" (https://wiki.bloodontheclocktower.com/Godfather). The night step says whether an
 * Outsider died today, and who.
 */
import { describe, expect, it } from 'vitest';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { nightAnswer } from './night-info.ts';

/** The night answer for a character that has one (each test's does). */
function answerOf(...args: Parameters<typeof nightAnswer>) {
	const a = nightAnswer(...args);
	if (!a) throw new Error(`no night answer for ${args[2]}`);
	return a;
}

const CAST = ['chef', 'butler', 'drunk', 'godfather', 'imp'];

describe('Godfather night answer', () => {
	it('says no when no Outsider died today', () => {
		const { session, seats } = castGame(CAST, { type: 'NewDay' }, (s) => ({
			type: 'Execute',
			seatId: s[0]
		}));
		expect(answerOf(session.game, seats[3], 'godfather', characters, { died: [] })).toMatchObject({
			kind: 'none',
			because: []
		});
	});

	it('names an Outsider executed today', () => {
		const { session, seats } = castGame(CAST, { type: 'NewDay' }, (s) => ({
			type: 'Execute',
			seatId: s[1]
		}));
		expect(answerOf(session.game, seats[3], 'godfather', characters)).toMatchObject({
			kind: 'yes-no',
			value: true,
			because: [seats[1]]
		});
	});

	it('counts an Outsider killed by day, and the Drunk by their true character', () => {
		const { session, seats } = castGame(CAST, { type: 'NewDay' }, (s) => ({
			type: 'SetDead',
			seatId: s[2],
			dead: true,
			cause: 'slayer'
		}));
		expect(
			answerOf(session.game, seats[3], 'godfather', characters, { died: [seats[2]] })
		).toMatchObject({ kind: 'yes-no', value: true, because: [seats[2]] });
	});

	it("counts the Godfather's Died Today reminder on a dead Outsider", () => {
		const { session, seats } = castGame(
			CAST,
			(s) => ({ type: 'SetDead', seatId: s[1], dead: true, cause: 'demon' }),
			(s) => ({
				type: 'AddReminder',
				seatId: s[1],
				reminder: { characterId: 'godfather', label: 'Died Today' }
			})
		);
		expect(answerOf(session.game, seats[3], 'godfather', characters)).toMatchObject({
			because: [seats[1]]
		});
	});
});
