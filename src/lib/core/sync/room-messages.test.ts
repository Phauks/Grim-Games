import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	cleanMessage,
	GRIM_VIEW_PREFIX,
	MAX_MESSAGE_LENGTH,
	MAX_VIEWER_NAME_LENGTH,
	MAX_MESSAGES_PER_MEMBER,
	MAX_ROOM_MESSAGE_CHARS,
	MESSAGE_GAP_MS
} from './room-messages.ts';
import {
	hostView,
	join,
	newRoom,
	playerView,
	publish,
	readMessages,
	seat,
	sendMessage,
	setName,
	setInbox,
	sendViewerMessage,
	setSpectatorMessages,
	viewersMayMessage,
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

	it("stop once a game's messages would grow too large for the room", () => {
		let r = room();
		for (const m of ['cam', 'dee', 'eli']) r = join(r, m)!;
		const long = 'a'.repeat(MAX_MESSAGE_LENGTH);
		const fit = MAX_ROOM_MESSAGE_CHARS / MAX_MESSAGE_LENGTH;
		const members = ['alex', 'sam', 'cam', 'dee', 'eli'];
		for (let i = 0; i < fit; i++) {
			r = sendMessage(r, members[i % 5], long, i * MESSAGE_GAP_MS, `m${i}`);
		}
		expect(r.messages).toHaveLength(fit);
		expect(sendMessage(r, 'alex', 'Hi', 10 ** 9, 'x')).toBe(r);
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

	it('can be marked unread again (Trevor, 2026-10-28)', () => {
		const r = readMessages(sendMessage(room(), 'alex', 'One', 1000, 'm1'), ['m1']);
		const unread = readMessages(r, ['m1'], false);
		expect(unread.messages?.[0]).not.toHaveProperty('read');
		expect(hostView(unread).messages?.[0].read).toBeUndefined();
		expect(readMessages(unread, ['m1'], false)).toBe(unread);
	});

	it('belong to their game: a new game empties the inbox', () => {
		const r = sendMessage(room(), 'alex', 'One', 1000, 'm1');
		expect(publish(r, 'g1', table()).messages).toHaveLength(1);
		expect(publish(r, 'g2', table()).messages).toBeUndefined();
		expect(publish(r, 'g2', table()).inbox).toBe(true);
	});
});

// Trevor (2026-11-03): "allow storyteller to enable or disable spectators from messaging the
// storyteller". A spectator is a phone in the room with no seat.
describe('spectators’ messages', () => {
	/** Sam sits in seat a; Alex has no seat, so watches. */
	const seated = () => seat(setName(room(), 'sam', { name: 'Sam' }), 'sam', 'a');

	it('reach the Storyteller until the Storyteller turns them off', () => {
		const r = sendMessage(seated(), 'alex', 'Hello', 1000, 'm1');
		expect(r.messages?.map((m) => m.memberId)).toEqual(['alex']);
		expect(playerView(seated(), 'alex').inbox).toBe(true);
		expect(hostView(seated()).spectatorsMuted).toBeUndefined();
	});

	it('are dropped while off, and a spectator’s phone is not offered Send', () => {
		const off = setSpectatorMessages(seated(), false);
		expect(hostView(off).spectatorsMuted).toBe(true);
		expect(sendMessage(off, 'alex', 'Hello', 1000, 'm1')).toBe(off);
		expect(playerView(off, 'alex').inbox).toBeUndefined();
		// A player with a seat still may.
		expect(playerView(off, 'sam').inbox).toBe(true);
		expect(sendMessage(off, 'sam', 'Hi', 1000, 'm2').messages).toHaveLength(1);
	});

	it('come back on, and ignore anything but on or off', () => {
		const off = setSpectatorMessages(seated(), false);
		expect(setSpectatorMessages(off, 'yes')).toBe(off);
		expect(setSpectatorMessages(off, false)).toBe(off);
		const on = setSpectatorMessages(off, true);
		expect(on.spectatorsMuted).toBeUndefined();
		expect(setSpectatorMessages(on, true)).toBe(on);
	});

	it('stay off from one game to the next in the room', () => {
		const off = setSpectatorMessages(seated(), false);
		expect(publish(off, 'g2', table()).spectatorsMuted).toBe(true);
	});
});

// Trevor (2026-11-03): "those with grim view could also message storyteller".
describe('messages from Grim view', () => {
	const watched = (r: RoomState): RoomState => ({ ...r, viewerKeyHash: 'k' });

	it('reach the Storyteller with the device’s name, while the link is on', () => {
		const r = sendViewerMessage(
			watched(room()),
			{ from: 'device-1234', name: '  Pat  ', text: 'Hi' },
			1000,
			'm1'
		);
		expect(r.messages).toEqual([
			expect.objectContaining({
				id: 'm1',
				memberId: `${GRIM_VIEW_PREFIX}device-1234`,
				name: 'Pat',
				text: 'Hi'
			})
		]);
		expect(viewersMayMessage(watched(room()))).toBe(true);
		// The link off: nobody is watching, so nothing comes.
		expect(viewersMayMessage(room())).toBe(false);
		expect(
			sendViewerMessage(room(), { from: 'device-1234', name: 'Pat', text: 'Hi' }, 1000, 'm1')
		).toEqual(room());
	});

	it('follow the spectators’ switch', () => {
		const off = setSpectatorMessages(watched(room()), false);
		expect(viewersMayMessage(off)).toBe(false);
		expect(
			sendViewerMessage(off, { from: 'device-1234', name: 'Pat', text: 'Hi' }, 1000, 'm1')
		).toBe(off);
	});

	it('need a device id, and keep a name only if there is one', () => {
		const r = watched(room());
		expect(sendViewerMessage(r, { from: 'x', name: 'Pat', text: 'Hi' }, 1000, 'm1')).toBe(r);
		expect(
			sendViewerMessage(r, { from: 'bad id with spaces', name: 'Pat', text: 'Hi' }, 1000, 'm1')
		).toBe(r);
		const nameless = sendViewerMessage(
			r,
			{ from: 'device-1234', name: '   ', text: 'Hi' },
			1000,
			'm1'
		);
		expect(nameless.messages?.[0].name).toBeUndefined();
		const long = sendViewerMessage(
			r,
			{ from: 'device-1234', name: 'P'.repeat(99), text: 'Hi' },
			1000,
			'm1'
		);
		expect(long.messages?.[0].name).toHaveLength(MAX_VIEWER_NAME_LENGTH);
	});

	it('are limited per device as a phone is', () => {
		let r = watched(room());
		r = sendViewerMessage(r, { from: 'device-1234', name: 'Pat', text: 'One' }, 1000, 'm1');
		expect(
			sendViewerMessage(r, { from: 'device-1234', name: 'Pat', text: 'Two' }, 1000 + 1, 'm2')
		).toBe(r);
		expect(
			sendViewerMessage(r, { from: 'device-5678', name: 'Lee', text: 'Two' }, 1000 + 1, 'm2')
				.messages
		).toHaveLength(2);
	});
});
