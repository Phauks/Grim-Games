/**
 * A finished game's recap. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Scarlet_Woman (becomes the Demon, so her starting
 *   and final characters differ)
 * - https://wiki.bloodontheclocktower.com/Gossip (a public statement the Storyteller notes)
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { buildRecap, gameAt } from './recap.ts';

const TB = ['gossip', 'chef', 'empath', 'saint', 'scarletwoman', 'imp'];

function finished() {
	const { session, seats } = castGame(
		TB,
		{ type: 'NewDay' },
		(s): Command => ({ type: 'SetSeatNote', seatId: s[1], note: 'Claimed Chef, true' }),
		(s): Command => ({
			type: 'DayNote',
			characterId: 'gossip',
			seatId: s[0],
			text: 'Said Ben is the Demon'
		}),
		(s): Command => ({ type: 'Execute', seatId: s[5] }),
		(s): Command => ({ type: 'AssignCharacter', seatId: s[4], characterId: 'imp' })
	);
	return { session, seats };
}

describe('buildRecap', () => {
	it('lists each seat at the end, with who they were at the first Dawn when it changed', () => {
		const { session } = finished();
		const recap = buildRecap({
			game: session.game,
			entries: session.log.entries,
			cursor: session.log.cursor,
			characters,
			winner: 'good',
			reason: 'demon-dead'
		});
		expect(recap.result).toBe('Good won');
		expect(recap.howEnded).toBe('Demon died');
		const woman = recap.seats[4];
		expect(woman.start?.name).toBe('Scarlet Woman');
		expect(woman.end?.name).toBe('Imp');
		expect(recap.seats[5]).toMatchObject({ dead: true, death: 'Executed' });
		expect(recap.seats[5].seatId).toBe(session.game.seating[5]);
	});

	it('gathers seat notes, then the day log’s notes', () => {
		const { session } = finished();
		const recap = buildRecap({
			game: session.game,
			entries: session.log.entries,
			cursor: session.log.cursor,
			characters
		});
		expect(recap.notes).toEqual([
			{ about: 'Ben', text: 'Claimed Chef, true' },
			{ about: 'Day 1, Ana (Gossip)', text: 'Said Ben is the Demon' }
		]);
		expect(recap.result).toBe('Winner not recorded');
		expect(recap.howEnded).toBeUndefined();
	});

	it('words the history oldest first, leaving out undone changes', () => {
		const { session } = finished();
		const all = buildRecap({
			game: session.game,
			entries: session.log.entries,
			cursor: session.log.cursor,
			characters
		});
		const fewer = buildRecap({
			game: session.game,
			entries: session.log.entries,
			cursor: session.log.cursor - 1,
			characters
		});
		expect(fewer.log).toHaveLength(all.log.length - 1);
		expect(all.log.at(-1)?.text).toContain('Imp');
	});
});

describe('gameAt', () => {
	it('replays the log up to a cursor', () => {
		const { session } = finished();
		expect(gameAt(session.log.entries, session.log.cursor)?.seats).toEqual(session.game.seats);
		expect(gameAt(session.log.entries, 0)).toBeUndefined();
	});
});
