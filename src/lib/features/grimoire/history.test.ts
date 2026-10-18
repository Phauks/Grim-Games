import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import {
	createGame,
	dispatch,
	undo,
	type Command,
	type EngineContext,
	type GameSession
} from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { historyItems, seatChanges } from './history.ts';

const data = committedGameData();
const script = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, script);
let n = 0;
const ctx: EngineContext = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };

function play(...commands: ((s: GameSession) => Command)[]): GameSession {
	const created = createGame({ type: 'CreateGame', script, playerCount: 5 }, ctx);
	if (!created.ok) throw new Error(created.error.message);
	let session = created.session;
	for (const make of commands) {
		const result = dispatch(session, make(session), ctx);
		if (!result.ok) throw new Error(result.error.message);
		session = result.session;
	}
	return session;
}

const first = (s: GameSession) => s.game.seating[0];
const second = (s: GameSession) => s.game.seating[1];

describe('historyItems', () => {
	// Trevor (2026-10-18): drawing a token and confirming it are one line, and one step.
	it('words a confirmed draw as one line saying which token the seat drew', () => {
		const tile = (s: GameSession) => s.game.bag!.order[0];
		const session = play(
			() => ({
				type: 'BuildBag',
				tiles: [{ shows: 'chef', grimoire: 'chef', reminders: [] }],
				includeTravellers: false,
				shuffle: false
			}),
			(s) => ({ type: 'DrawTile', seatId: first(s), tileId: tile(s) }),
			(s) => ({ type: 'ConfirmDraw', tileId: Object.keys(s.game.bag!.tiles)[0] })
		);
		const items = historyItems(session.log.entries, session.log.cursor, characters);
		expect(items.map((i) => i.cursor)).toEqual([4, 2, 1]);
		expect(items[0].parts).toEqual([
			{ kind: 'text', text: 'Seat 1' },
			{ kind: 'text', text: ' drew ' },
			{ kind: 'character', characterId: 'chef' }
		]);
		// Not yet confirmed: the draw has its own line.
		const drawn = historyItems(session.log.entries.slice(0, 3), 3, characters);
		expect(drawn[0].parts).toEqual([
			{ kind: 'text', text: 'Seat 1' },
			{ kind: 'text', text: ' drew a token' }
		]);
	});
	it('words each change with the seat as it was, newest first', () => {
		const session = play(
			(s) => ({ type: 'RenameSeat', seatId: first(s), playerName: 'Ana' }),
			(s) => ({ type: 'AssignCharacter', seatId: first(s), characterId: 'imp' }),
			(s) => ({ type: 'SwapSeats', seatA: first(s), seatB: second(s) })
		);
		const items = historyItems(session.log.entries, session.log.cursor, characters);
		expect(items.map((i) => i.cursor)).toEqual([4, 3, 2, 1]);
		expect(items[0].parts).toEqual([
			{ kind: 'text', text: 'Swapped ' },
			{ kind: 'seat', name: 'Ana', characterId: 'imp', alignment: 'evil' },
			{ kind: 'text', text: ' and ' },
			{ kind: 'seat', name: 'Seat 2' }
		]);
		expect(items[1].parts).toEqual([
			{ kind: 'text', text: 'Ana' },
			{ kind: 'text', text: ' is ' },
			{ kind: 'character', characterId: 'imp' }
		]);
		expect(items[3].parts).toEqual([{ kind: 'text', text: 'New game: Trouble Brewing, 5 seats' }]);
	});

	it('marks undone changes, which stay until a new change', () => {
		const session = undo(
			play((s) => ({ type: 'RenameSeat', seatId: first(s), playerName: 'Ana' }))
		);
		const items = historyItems(session.log.entries, session.log.cursor, characters);
		expect(items[0]).toMatchObject({ cursor: 2, undone: true });
		expect(items[1]).toMatchObject({ cursor: 1, undone: false });
	});

	it('words seat order changes: a rotation and a move', () => {
		const session = play(
			(s) => ({ type: 'RenameSeat', seatId: first(s), playerName: 'Ana' }),
			() => ({ type: 'RotateSeats', direction: 'clockwise' }),
			(s) => ({ type: 'MoveSeat', seatId: s.game.seating[1], position: 3 })
		);
		const [moved, rotated] = historyItems(session.log.entries, session.log.cursor, characters);
		expect(rotated.parts).toEqual([{ kind: 'text', text: 'Rotated the seats clockwise' }]);
		expect(moved.parts).toEqual([
			{ kind: 'seat', name: 'Ana' },
			{ kind: 'text', text: ' moved to seat 4' }
		]);
	});

	it("words day log changes in the day screen's words", () => {
		const session = play(
			(s) => ({ type: 'RenameSeat', seatId: first(s), playerName: 'Ana' }),
			(s) => ({ type: 'RenameSeat', seatId: second(s), playerName: 'Ben' }),
			(s) => ({ type: 'Nominate', nominator: first(s), nominee: second(s) }),
			() => ({ type: 'SetDemonVoted', voted: true })
		);
		const [voted, nominated] = historyItems(session.log.entries, session.log.cursor, characters);
		expect(nominated.parts).toEqual([{ kind: 'text', text: 'Ana nominated Ben' }]);
		expect(voted.parts).toEqual([{ kind: 'text', text: 'Demon voted' }]);
	});
});

describe('seatChanges', () => {
	it("lists a seat's character and alignment changes, not its first character", () => {
		// The Fang Gu jumps into an Outsider, who becomes the evil Fang Gu
		// (https://wiki.bloodontheclocktower.com/Fang_Gu); here shown as a Recluse turned evil.
		const session = play(
			(s) => ({ type: 'AssignCharacter', seatId: first(s), characterId: 'recluse' }),
			(s) => ({ type: 'AssignCharacter', seatId: second(s), characterId: 'imp' }),
			(s) => ({ type: 'AssignCharacter', seatId: first(s), characterId: 'imp' }),
			(s) => ({ type: 'SetAlignment', seatId: first(s), alignment: 'evil' })
		);
		const seatId = first(session);
		expect(seatChanges(session.log.entries, session.log.cursor, seatId)).toEqual([
			{ kind: 'character', at: 0, from: 'recluse', to: 'imp' },
			{ kind: 'alignment', at: 0, from: 'good', to: 'evil' }
		]);
		expect(seatChanges(session.log.entries, session.log.cursor, second(session))).toEqual([]);
		// Undone changes are not shown.
		expect(seatChanges(session.log.entries, session.log.cursor - 2, seatId)).toEqual([]);
	});
});
