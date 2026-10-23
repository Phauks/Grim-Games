import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	cancelRequest,
	canReveal,
	castVote,
	closeVote,
	gameOver,
	hostView,
	isScript,
	isSharedGrimoire,
	join,
	MAX_MEMBERS,
	MIN_ROOM_PROTOCOL,
	newRoom,
	openVote,
	parseClientMessage,
	playerView,
	publish,
	reopenGame,
	request,
	resolve,
	ROOM_PROTOCOL,
	roomPreview,
	setLook,
	setViewers,
	supportsProtocol,
	unseat,
	viewerFailed,
	viewersLocked,
	MAX_VIEWER_FAILS,
	VIEWER_FAIL_WINDOW_MS,
	type RoomState
} from './room.ts';

const s = (id: string) => id as SeatId;

function table(...ids: string[]): PublicGameState {
	return {
		seats: ids.map((id, i) => ({
			seatId: s(id),
			seatNumber: i + 1,
			dead: false
		})),
		today: { nominations: [], executions: [] }
	};
}

function roomWith(...members: string[]): RoomState {
	let room = publish(newRoom('hash'), 'g1', table('a', 'b', 'c'));
	for (const m of members) room = join(room, m)!;
	return room;
}

describe('the live room', () => {
	it('lets a phone ask for a seat, and only the Storyteller seats it', () => {
		let room = roomWith('alex');
		room = request(room, 'alex', { name: '  Alex   K ', seatId: 'b' }, 1, 'r1');
		expect(room.requests).toEqual([
			{ requestId: 'r1', memberId: 'alex', name: 'Alex K', seatId: 'b', at: 1 }
		]);
		expect(playerView(room, 'alex').me).toEqual({ memberId: 'alex' });
		expect(playerView(room, 'alex').request).toEqual({ name: 'Alex K', seatId: 'b' });

		room = resolve(room, 'r1', true);
		expect(room.requests).toEqual([]);
		expect(playerView(room, 'alex').me).toEqual({ memberId: 'alex', name: 'Alex K', seatId: 'b' });
		expect(playerView(room, 'alex').takenSeats).toEqual(['b']);
	});

	it('lets the Storyteller choose a different seat', () => {
		let room = request(roomWith('alex'), 'alex', { name: 'Alex' }, 1, 'r1');
		room = resolve(room, 'r1', true, s('c'));
		expect(room.members).toEqual([{ memberId: 'alex', name: 'Alex', seatId: 'c' }]);
	});

	it('drops a declined request without changing the member', () => {
		let room = request(roomWith('alex'), 'alex', { name: 'Alex' }, 1, 'r1');
		room = resolve(room, 'r1', false);
		expect(room.requests).toEqual([]);
		expect(room.members).toEqual([{ memberId: 'alex' }]);
	});

	it('keeps one request per phone, and lets it be cancelled', () => {
		let room = request(roomWith('alex'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r1');
		room = request(room, 'alex', { name: 'Alex', seatId: 'c' }, 2, 'r2');
		expect(room.requests.map((r) => r.requestId)).toEqual(['r2']);
		expect(cancelRequest(room, 'alex').requests).toEqual([]);
	});

	it('ignores empty names, unknown seats and strangers', () => {
		const room = roomWith('alex');
		expect(request(room, 'alex', { name: '   ' }, 1, 'r')).toBe(room);
		expect(request(room, 'alex', { name: 'Alex', seatId: 'zz' }, 1, 'r')).toBe(room);
		expect(request(room, 'alex', { name: 'Alex', seatId: 7 }, 1, 'r')).toBe(room);
		expect(request(room, 'nobody', { name: 'Eve' }, 1, 'r')).toBe(room);
		expect(request(room, 'alex', { name: 42 }, 1, 'r')).toBe(room);
	});

	it('moves an earlier phone out of a seat the Storyteller gives to someone else', () => {
		let room = request(roomWith('alex', 'sam'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r1');
		room = resolve(room, 'r1', true);
		room = resolve(request(room, 'sam', { name: 'Sam', seatId: 'a' }, 2, 'r2'), 'r2', true);
		expect(room.members).toEqual([
			{ memberId: 'alex', name: 'Alex' },
			{ memberId: 'sam', name: 'Sam', seatId: 'a' }
		]);
	});

	it('unseats a player but keeps their name', () => {
		let room = resolve(
			request(roomWith('alex'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r'),
			'r',
			true
		);
		room = unseat(room, 'alex');
		expect(room.members).toEqual([{ memberId: 'alex', name: 'Alex' }]);
	});

	it('clears seats for a removed seat or a new game, keeping names', () => {
		let room = resolve(
			request(roomWith('alex'), 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r'),
			'r',
			true
		);
		room = request(room, 'alex', { name: 'Alex', seatId: 'b' }, 2, 'r2');
		expect(publish(room, 'g1', table('a', 'b')).members[0].seatId).toBe('a');

		const removed = publish(room, 'g1', table('b', 'c'));
		expect(removed.members).toEqual([{ memberId: 'alex', name: 'Alex' }]);

		const next = publish(room, 'g2', table('a', 'b'));
		expect(next.members).toEqual([{ memberId: 'alex', name: 'Alex' }]);
		expect(next.requests[0]).not.toHaveProperty('seatId');
		expect(next.gameId).toBe('g2');
	});

	it("keeps each phone's avatar and frame, without asking, through seat changes (plan R6)", () => {
		let room = roomWith('alex', 'sam');
		room = setLook(room, 'alex', { avatar: 'cat', frame: 'ring' });
		expect(room.members[0]).toEqual({ memberId: 'alex', avatar: 'cat', frame: 'ring' });
		expect(hostView(room).members[0]).toMatchObject({ avatar: 'cat', frame: 'ring' });
		expect(setLook(room, 'alex', { avatar: 'cat', frame: 'ring' })).toBe(room);
		expect(setLook(room, 'nobody', { avatar: 'cat' })).toBe(room);
		// Unknown pictures and frames are dropped, as if none were picked.
		expect(setLook(room, 'alex', { avatar: 'skull', frame: 3 }).members[0]).toEqual({
			memberId: 'alex'
		});

		room = resolve(request(room, 'alex', { name: 'Alex', seatId: 'a' }, 1, 'r1'), 'r1', true);
		room = resolve(request(room, 'sam', { name: 'Sam', seatId: 'a' }, 2, 'r2'), 'r2', true);
		expect(room.members[0]).toEqual({
			memberId: 'alex',
			name: 'Alex',
			avatar: 'cat',
			frame: 'ring'
		});
		room = resolve(request(room, 'alex', { name: 'Alex', seatId: 'b' }, 3, 'r3'), 'r3', true);
		expect(publish(room, 'g2', table('a', 'b')).members[0]).toEqual({
			memberId: 'alex',
			name: 'Alex',
			avatar: 'cat',
			frame: 'ring'
		});
		expect(parseClientMessage('{"type":"look","avatar":"cat"}')).toEqual({
			type: 'look',
			avatar: 'cat'
		});
	});

	it('turns phones away once the room is full', () => {
		let room = newRoom('hash');
		for (let i = 0; i < MAX_MEMBERS; i++) room = join(room, `m${i}`)!;
		expect(join(room, 'one-more')).toBeNull();
		expect(join(room, 'm0')).toBe(room);
	});

	it('ignores malformed messages', () => {
		expect(parseClientMessage('not json')).toBeNull();
		expect(parseClientMessage('[1]')).toBeNull();
		expect(parseClientMessage('{"type":1}')).toBeNull();
		expect(parseClientMessage('{"type":"leave-seat"}')).toEqual({ type: 'leave-seat' });
	});

	it('tells apps older than the room speaks to update, and still accepts this build', () => {
		expect(supportsProtocol(ROOM_PROTOCOL)).toBe(true);
		// Apps from before the protocol number existed speak protocol 1.
		expect(supportsProtocol(undefined)).toBe(MIN_ROOM_PROTOCOL <= 1);
		expect(supportsProtocol(MIN_ROOM_PROTOCOL - 1)).toBe(false);
		expect(supportsProtocol('1')).toBe(false);
		expect(supportsProtocol(1.5)).toBe(false);
	});
});

describe('the end of a game', () => {
	it('tells every phone the game is over, with who won and how', () => {
		const room = gameOver(roomWith('alex'), 'g1', 'evil', 'two-alive');
		expect(playerView(room, 'alex').ended).toEqual({ winner: 'evil', reason: 'two-alive' });
		// The table stays as it was, for what comes after.
		expect(playerView(room, 'alex').public).toEqual(table('a', 'b', 'c'));
	});

	it('keeps only what it can trust', () => {
		const room = roomWith('alex');
		expect(gameOver(room, 'g2', 'good')).toBe(room);
		expect(gameOver(room, 7)).toBe(room);
		expect(playerView(gameOver(room, 'g1', 'purple', 'demon-dead'), 'alex').ended).toEqual({});
		// How it ended means nothing without a winner, and a reason is short.
		expect(playerView(gameOver(room, 'g1', undefined, 'other'), 'alex').ended).toEqual({});
		expect(playerView(gameOver(room, 'g1', 'good', 'x'.repeat(200)), 'alex').ended).toEqual({
			winner: 'good'
		});
	});

	it('ends when the game is reopened, or a new game starts', () => {
		const over = gameOver(roomWith('alex'), 'g1', 'good');
		expect(reopenGame(over, 'g2')).toBe(over);
		expect(playerView(reopenGame(over, 'g1'), 'alex').ended).toBeUndefined();
		// The same game published again is still over.
		expect(playerView(publish(over, 'g1', table('a', 'b')), 'alex').ended).toEqual({
			winner: 'good'
		});
		const next = publish(over, 'g2', table('a', 'b', 'c'));
		expect(next.ended).toBeUndefined();
		expect(playerView(next, 'alex').ended).toBeUndefined();
	});

	it('lets the Storyteller share the finished grimoire only for the game that ended', () => {
		const room = roomWith('alex');
		expect(canReveal(room, 'g1')).toBe(false);
		const over = gameOver(room, 'g1', 'good');
		expect(canReveal(over, 'g1')).toBe(true);
		expect(canReveal(over, 'g2')).toBe(false);
		expect(canReveal(over, 7)).toBe(false);
		// Reopened, or a new game: the grimoire is private again.
		expect(canReveal(reopenGame(over, 'g1'), 'g1')).toBe(false);
		expect(canReveal(publish(over, 'g2', table('a')), 'g1')).toBe(false);
	});

	it('needs protocol 2, so an older app is told to update rather than miss the end', () => {
		expect(ROOM_PROTOCOL).toBeGreaterThanOrEqual(2);
		expect(supportsProtocol(1)).toBe(false);
	});
});

describe('the script a room relays', () => {
	it('accepts official and custom entries', () => {
		expect(isScript({ entries: [] })).toBe(true);
		expect(
			isScript({
				meta: { name: 'Mine' },
				entries: [
					{ kind: 'official', id: 'washerwoman' },
					{ kind: 'custom', character: { id: 'x' } }
				]
			})
		).toBe(true);
	});

	it('refuses anything else', () => {
		expect(isScript(null)).toBe(false);
		expect(isScript(['washerwoman'])).toBe(false);
		expect(isScript({ entries: [{ kind: 'official' }] })).toBe(false);
		expect(isScript({ entries: [{ kind: 'custom', character: null }] })).toBe(false);
		expect(isScript({ entries: ['washerwoman'] })).toBe(false);
	});
});

describe('what a phone sees before it joins', () => {
	it('says only that there is no room when there is none', () => {
		expect(roomPreview(undefined, { entries: [] })).toEqual({ open: false });
	});

	it('shows an open room before the Storyteller has sent anything', () => {
		expect(roomPreview(newRoom('hash'))).toEqual({ open: true });
	});

	it("shows the script's name, author and logo, and the table's size", () => {
		let room = roomWith('m1', 'm2');
		room = resolve(request(room, 'm1', { name: 'Ana', seatId: s('b') }, 1, 'r1'), 'r1', true);
		expect(
			roomPreview(room, {
				meta: { name: 'Storm Front', author: 'Kim', logo: 'https://logo.example/s.png' },
				entries: [
					{ kind: 'official', id: 'washerwoman' },
					{ kind: 'custom', character: { id: 'x' } as never }
				]
			})
		).toEqual({
			open: true,
			script: {
				name: 'Storm Front',
				author: 'Kim',
				logo: 'https://logo.example/s.png',
				official: false
			},
			seats: 3,
			seated: 1
		});
	});

	it("shows the Storyteller's name once the game has one", () => {
		const room = publish(roomWith('m1'), 'g1', { ...table('a'), storytellerName: 'Sam' });
		expect(roomPreview(room).storyteller).toBe('Sam');
		expect('storyteller' in roomPreview(publish(room, 'g1', table('a')))).toBe(false);
	});

	it('marks a script with no characters of its own as official', () => {
		expect(
			roomPreview(newRoom('hash'), {
				meta: { name: 'Trouble Brewing' },
				entries: [{ kind: 'official', id: 'washerwoman' }]
			}).script
		).toEqual({ name: 'Trouble Brewing', official: true });
	});
});

/** Specters: spectators share one ability and vote on how it is used (https://www.youtube.com/watch?v=-R34QbIgDh8). */
describe('a spectators’ vote', () => {
	function seated(room: RoomState, memberId: string, seatId: string): RoomState {
		room = request(room, memberId, { name: memberId, seatId }, 1, `r-${memberId}`);
		return resolve(room, `r-${memberId}`, true);
	}

	it('counts only spectators, one choice each, and shows the vote to spectators only', () => {
		let room = seated(roomWith('p', 'x', 'y'), 'p', 'a');
		room = openVote(room, 'v1', ['a', 'b', 'b', 'nope']);
		expect(room.vote?.options).toEqual(['a', 'b']);
		room = castVote(room, 'x', 'v1', 'b');
		room = castVote(room, 'y', 'v1', 'a');
		room = castVote(room, 'y', 'v1', 'b');
		// A seated player and a stale vote change nothing.
		room = castVote(room, 'p', 'v1', 'a');
		room = castVote(room, 'x', 'v0', 'a');
		expect(hostView(room).vote).toEqual({
			voteId: 'v1',
			options: ['a', 'b'],
			counts: { a: 0, b: 2 },
			voted: 2,
			spectators: 2
		});
		expect(playerView(room, 'x').vote).toEqual({ voteId: 'v1', options: ['a', 'b'], choice: 'b' });
		expect(playerView(room, 'p').vote).toBeUndefined();
	});

	it('carries what the vote is for to spectators, trimmed and capped', () => {
		let room = roomWith('x');
		room = openVote(room, 'v1', ['a'], '  Gains the Wizard ability  ');
		expect(playerView(room, 'x').vote?.ability).toBe('Gains the Wizard ability');
		expect(openVote(room, 'v2', ['a'], 'z'.repeat(900)).vote?.ability).toHaveLength(500);
		expect(openVote(room, 'v3', ['a'], 7).vote?.ability).toBeUndefined();
	});

	it('does not open without options, and closes for everyone', () => {
		const room = roomWith('x');
		expect(openVote(room, 'v1', ['nope']).vote).toBeUndefined();
		const open = openVote(room, 'v1', ['a']);
		expect(closeVote(open).vote).toBeUndefined();
		expect(hostView(closeVote(open)).vote).toBeUndefined();
	});

	it('closes when a different game is published', () => {
		const open = openVote(roomWith('x'), 'v1', ['a']);
		expect(publish(open, 'g1', table('a', 'b')).vote).toBeDefined();
		expect(publish(open, 'g2', table('a', 'b')).vote).toBeUndefined();
	});
});

describe('the view-only grimoire link', () => {
	const hash = 'a'.repeat(64);

	it('is turned on with a key hash and off with null', () => {
		const on = setViewers(newRoom('host'), hash);
		expect(on.viewerKeyHash).toBe(hash);
		expect('viewerKeyHash' in setViewers(on, null)).toBe(false);
	});

	it('ignores anything that is not a SHA-256 hash', () => {
		const on = setViewers(newRoom('host'), hash);
		expect(setViewers(on, 'short')).toBe(on);
		expect(setViewers(on, 42)).toBe(on);
		expect(setViewers(on, undefined)).toBe(on);
	});

	it('never shows in what phones see before or after joining', () => {
		const room = setViewers(roomWith('alex'), hash);
		expect(JSON.stringify(roomPreview(room))).not.toContain(hash);
		expect(JSON.stringify(playerView(room, 'alex'))).not.toContain(hash);
		expect(JSON.stringify(hostView(room))).not.toContain(hash);
	});

	it('says when its key is made from a Grim view password, and nothing else of it', () => {
		const room = setViewers(roomWith('alex'), hash, true);
		expect(room.viewerPassword).toBe(true);
		expect(roomPreview(room).grimView).toBe(true);
		// A link with no password, or no link at all, offers no Grim view.
		expect(roomPreview(setViewers(room, hash)).grimView).toBeUndefined();
		expect(setViewers(room, hash).viewerPassword).toBeUndefined();
		expect(roomPreview(setViewers(room, null)).grimView).toBeUndefined();
	});

	it('slows guessing: too many wrong keys stop viewers for a while', () => {
		let fails = viewerFailed(undefined, 0);
		for (let i = 1; i < MAX_VIEWER_FAILS; i++) {
			expect(viewersLocked(fails, 1)).toBe(false);
			fails = viewerFailed(fails, 1);
		}
		expect(viewersLocked(fails, 1)).toBe(true);
		expect(viewersLocked(fails, VIEWER_FAIL_WINDOW_MS)).toBe(false);
		// The next window starts the count again.
		expect(viewerFailed(fails, VIEWER_FAIL_WINDOW_MS)).toEqual({
			count: 1,
			since: VIEWER_FAIL_WINDOW_MS
		});
	});

	it('relays a grimoire only when it carries a saved game', () => {
		expect(isSharedGrimoire({ saved: { schemaVersion: 11 } })).toBe(true);
		expect(isSharedGrimoire({ saved: [] })).toBe(false);
		expect(isSharedGrimoire({})).toBe(false);
		expect(isSharedGrimoire(null)).toBe(false);
	});
});
