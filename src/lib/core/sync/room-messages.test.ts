import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	cleanMessage,
	MAX_MESSAGE_LENGTH,
	MAX_MESSAGES_PER_MEMBER,
	MESSAGE_GAP_MS
} from './room-messages.ts';
import {
	hostView,
	join,
	newRoom,
	playerView,
	publish,
	readMessages,
	sendMessage,
	setInbox,
	type RoomState
} from './room.ts';

// Players' messages to the Storyteller (Trevor, 2026-10-27: "Unilateral messaging to
// storyteller"; "Players cannot see message once sent").

function table(now?: PublicGameState['now']): PublicGameState {
	return {
		seats: [{ seatId: 'a' as SeatId, seatNumber: 1, dead: false }],
		today: { nominations: [], executions: [] },
		...(now ? { now } : {})
	};
}

/** A room whose Storyteller's app shows messages, with Alex and Sam in it. */
function room(): RoomState {
	let r = setInbox(publish(newRoom('hash'), 'g1', table({ kind: 'day', number: 2 })), true);
	for (const m of ['alex', 'sam']) r = join(r, m)!;
	return r;
}

describe('player messages', () => {
	it('reach the Storyteller with when they were sent, and never go back to a phone', () => {
		const r = sendMessage(room(), 'alex', '  Can I swap seats?  ', 1000, 'm1');
		expect(hostView(r).messages).toEqual([
			{
				id: 'm1',
				memberId: 'alex',
				text: 'Can I swap seats?',
				at: 1000,
				phase: { kind: 'day', number: 2 }
			}
		]);
		expect(playerView(r, 'alex')).not.toHaveProperty('messages');
		expect(JSON.stringify(playerView(r, 'sam'))).not.toContain('swap');
	});

	it('are refused when the Storyteller’s app would not show them', () => {
		const r = setInbox(room(), false);
		expect(r.inbox).toBeUndefined();
		expect(sendMessage(r, 'alex', 'Hello', 1000, 'm1')).toBe(r);
		expect(playerView(r, 'alex').inbox).toBeUndefined();
		expect(playerView(room(), 'alex').inbox).toBe(true);
	});

	it('ignore strangers, empty text, floods and phones that send too fast', () => {
		let r = room();
		expect(sendMessage(r, 'stranger', 'Hi', 1, 'x')).toBe(r);
		expect(sendMessage(r, 'alex', '   ', 1, 'x')).toBe(r);
		expect(sendMessage(r, 'alex', 42, 1, 'x')).toBe(r);
		r = sendMessage(r, 'alex', 'One', 1000, 'm1');
		expect(sendMessage(r, 'alex', 'Two', 1000 + MESSAGE_GAP_MS - 1, 'm2')).toBe(r);
		// Another phone is not held up by Alex's.
		expect(sendMessage(r, 'sam', 'Mine', 1001, 'm3').messages).toHaveLength(2);
		for (let i = 1; i < MAX_MESSAGES_PER_MEMBER; i++) {
			r = sendMessage(r, 'alex', `#${i}`, 1000 + i * MESSAGE_GAP_MS, `n${i}`);
		}
		expect(r.messages).toHaveLength(MAX_MESSAGES_PER_MEMBER);
		expect(sendMessage(r, 'alex', 'More', 10 ** 9, 'z')).toBe(r);
	});

	it('may ask for a Storyteller consult, with or without words', () => {
		// Trevor, 2026-10-27: "add a checkmark to request a storyteller consult".
		const r = sendMessage(room(), 'alex', '', 1000, 'm1', true);
		expect(hostView(r).messages?.[0]).toMatchObject({ text: '', consult: true });
		const said = sendMessage(room(), 'alex', 'After the vote', 1000, 'm1', true);
		expect(said.messages?.[0]).toMatchObject({ text: 'After the vote', consult: true });
		expect(
			sendMessage(room(), 'alex', 'Hi', 1000, 'm1', 'yes').messages?.[0].consult
		).toBeUndefined();
		expect(sendMessage(room(), 'alex', '', 1000, 'm1', 'yes').messages).toBeUndefined();
	});

	it('are cut to length and cleaned of control characters', () => {
		expect(cleanMessage('a'.repeat(MAX_MESSAGE_LENGTH + 20))).toHaveLength(MAX_MESSAGE_LENGTH);
		expect(cleanMessage('a\u0007b\n\n\n\nc')).toBe('ab\n\nc');
		expect(cleanMessage(null)).toBeNull();
	});

	it('are marked read when the Storyteller opens them', () => {
		let r = sendMessage(room(), 'alex', 'One', 1000, 'm1');
		r = sendMessage(r, 'sam', 'Two', 1000, 'm2');
		const read = readMessages(r, ['m1', 'nope', 7]);
		expect(read.messages?.map((m) => m.read)).toEqual([true, undefined]);
		expect(readMessages(read, ['m1'])).toBe(read);
		expect(readMessages(read, 'm2')).toBe(read);
	});

	it('belong to their game: a new game empties the inbox', () => {
		const r = sendMessage(room(), 'alex', 'One', 1000, 'm1');
		expect(publish(r, 'g1', table()).messages).toHaveLength(1);
		expect(publish(r, 'g2', table()).messages).toBeUndefined();
		expect(publish(r, 'g2', table()).inbox).toBe(true);
	});
});
