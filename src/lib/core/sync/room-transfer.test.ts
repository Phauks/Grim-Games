import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	askTransfer,
	checkTransfer,
	closeTransfer,
	completeTransfer,
	dropAsk,
	hostView,
	join,
	makeTransferCode,
	newRoom,
	openTransfer,
	publish,
	seat,
	setName,
	transferDetails,
	TRANSFER_MS,
	type RoomState
} from './room.ts';

const s = (id: string) => id as SeatId;
const CODE_HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);

function table(): PublicGameState {
	return {
		storytellerName: 'Trevor',
		seats: ['a', 'b', 'c'].map((id, i) => ({ seatId: s(id), seatNumber: i + 1, dead: false })),
		today: { nominations: [], executions: [] },
		now: { kind: 'night', number: 3 }
	};
}

/** Trevor's room with Alex seated and Sam watching, game g1. */
function room(): RoomState {
	let r = publish(newRoom('old-host'), 'g1', table());
	r = seat(setName(join(r, 'alex')!, 'alex', { name: 'Alex' }), 'alex', 'a');
	return setName(join(r, 'sam')!, 'sam', { name: 'Sam' });
}

describe('room transfer', () => {
	it('makes eight-digit codes, unlike a six-digit room code, keeping leading zeros', () => {
		expect(makeTransferCode(() => 0)).toBe('00000000');
		expect(makeTransferCode(() => 0.0123456789)).toBe('01234567');
		expect(makeTransferCode(() => 0.999999999)).toBe('99999999');
	});

	it('opens for five minutes, and a switch change keeps the time and tries', () => {
		const opened = openTransfer(room(), CODE_HASH, false, 1000);
		expect(opened.transfer).toEqual({
			codeHash: CODE_HASH,
			endsAt: 1000 + TRANSFER_MS,
			tries: 0,
			bringGame: false
		});
		const wrong = checkTransfer(opened, OTHER_HASH, 2000).room;
		const changed = openTransfer(wrong, CODE_HASH, true, 5000);
		expect(changed.transfer).toMatchObject({
			endsAt: 1000 + TRANSFER_MS,
			tries: 1,
			bringGame: true
		});
		// A new code starts again.
		expect(openTransfer(wrong, OTHER_HASH, true, 5000).transfer).toMatchObject({
			endsAt: 5000 + TRANSFER_MS,
			tries: 0
		});
	});

	it('ignores a malformed hash', () => {
		const r = room();
		expect(openTransfer(r, 'not a hash', true, 0)).toBe(r);
	});

	it('shows the Storyteller how long is left', () => {
		const opened = openTransfer(room(), CODE_HASH, false, 0);
		expect(hostView(opened).transfer).toEqual({ endsAt: TRANSFER_MS, tries: 0 });
		expect(hostView(closeTransfer(opened)).transfer).toBeUndefined();
	});

	it('accepts the right code while it is open', () => {
		const opened = openTransfer(room(), CODE_HASH, false, 0);
		expect(checkTransfer(opened, CODE_HASH, TRANSFER_MS - 1)).toEqual({ ok: true, room: opened });
	});

	it('ends after three wrong codes, so a code cannot be guessed', () => {
		let r = openTransfer(room(), CODE_HASH, false, 0);
		const left: number[] = [];
		for (let i = 0; i < 3; i++) {
			const check = checkTransfer(r, OTHER_HASH, 10);
			expect(check.ok).toBe(false);
			if (!check.ok) left.push(check.triesLeft);
			r = check.room;
		}
		expect(left).toEqual([2, 1, 0]);
		expect(r.transfer).toBeUndefined();
		expect(checkTransfer(r, CODE_HASH, 10).ok).toBe(false);
	});

	it('refuses even the right code once it has run out', () => {
		const opened = openTransfer(room(), CODE_HASH, false, 0);
		const check = checkTransfer(opened, CODE_HASH, TRANSFER_MS);
		expect(check).toEqual({ ok: false, room: closeTransfer(opened), triesLeft: 0 });
	});

	it('asks the Storyteller before anyone takes over, with the asker’s name', () => {
		const opened = openTransfer(room(), CODE_HASH, false, 0);
		const asked = askTransfer(opened, 'new-host', '  Pat  ');
		expect(asked.transfer?.asking).toEqual({ keyHash: 'new-host', name: 'Pat' });
		// The Storyteller's device sees the name, never the key.
		expect(hostView(asked).transfer).toEqual({
			endsAt: TRANSFER_MS,
			tries: 0,
			asking: { name: 'Pat' }
		});
		expect(hostView(askTransfer(opened, 'new-host', 7)).transfer?.asking).toEqual({});
		// A later ask replaces it; a switch change keeps it.
		expect(askTransfer(asked, 'other', '').transfer?.asking).toEqual({ keyHash: 'other' });
		expect(openTransfer(asked, CODE_HASH, true, 9).transfer?.asking).toEqual(
			asked.transfer?.asking
		);
		// Denied: the transfer stays open, unasked.
		expect(dropAsk(asked).transfer).toEqual(opened.transfer);
		// No transfer, no ask.
		const closed = room();
		expect(askTransfer(closed, 'new-host', 'Pat')).toBe(closed);
	});

	it('tells the device taking over who runs it and how many play', () => {
		expect(transferDetails(openTransfer(room(), CODE_HASH, false, 0))).toEqual({
			storyteller: 'Trevor',
			players: 1
		});
		expect(transferDetails(openTransfer(room(), CODE_HASH, true, 0))).toEqual({
			storyteller: 'Trevor',
			players: 1,
			game: { phase: { kind: 'night', number: 3 } }
		});
	});

	it('hands the room over with its players, leaving the old Storyteller’s things behind', () => {
		const before: RoomState = {
			...openTransfer(room(), CODE_HASH, true, 0),
			viewerKeyHash: 'viewers',
			viewerPassword: true,
			messages: [{ id: 'm', memberId: 'alex', text: 'psst', at: 1 }]
		} as RoomState;
		const after = completeTransfer(before, 'new-host');
		expect(after.hostKeyHash).toBe('new-host');
		expect(after.members).toEqual(before.members);
		expect(after.gameId).toBe('g1');
		expect(after.public).toEqual(before.public);
		expect(after.transfer).toBeUndefined();
		expect(after.viewerKeyHash).toBeUndefined();
		expect(after.viewerPassword).toBeUndefined();
		expect(after.messages).toBeUndefined();
	});
});
