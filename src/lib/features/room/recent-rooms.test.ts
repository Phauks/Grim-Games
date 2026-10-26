import { describe, expect, it } from 'vitest';
import { MAX_RECENT_ROOMS, parseRecentRooms, withRecentRoom } from './recent-rooms.ts';

describe('the rooms this phone joined', () => {
	it('puts the latest first and keeps a few', () => {
		let rooms = withRecentRoom([], { code: '111111', script: 'Trouble Brewing', at: 1 });
		for (let i = 2; i <= MAX_RECENT_ROOMS + 1; i++) {
			rooms = withRecentRoom(rooms, { code: `${i}`.repeat(6), at: i });
		}
		expect(rooms.map((r) => r.code)).toEqual(['666666', '555555', '444444', '333333', '222222']);
	});

	it("keeps a room's script name when it is opened again before the script arrives", () => {
		const rooms = withRecentRoom([{ code: '111111', script: 'Trouble Brewing', at: 1 }], {
			code: '111111',
			at: 2
		});
		expect(rooms).toEqual([{ code: '111111', script: 'Trouble Brewing', at: 2 }]);
	});

	it('reopens a room the way it was last opened, as a player or a Public Town display', () => {
		let rooms = withRecentRoom([], { code: '111111', at: 1, town: true });
		expect(rooms).toEqual([{ code: '111111', at: 1, town: true }]);
		expect(parseRecentRooms(rooms)).toEqual(rooms);
		rooms = withRecentRoom(rooms, { code: '111111', at: 2 });
		expect(rooms).toEqual([{ code: '111111', at: 2 }]);
	});

	it('ignores anything stored that is not a room', () => {
		expect(parseRecentRooms('x')).toEqual([]);
		expect(
			parseRecentRooms([
				{ code: '482 913', at: 1 },
				{ code: '482913', at: 2 },
				{ code: 'nope', at: 3 },
				{ code: '111111' },
				null
			])
		).toEqual([{ code: '482913', at: 1 }]);
	});
});
