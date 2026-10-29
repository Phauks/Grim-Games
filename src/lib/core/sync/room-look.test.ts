import { describe, expect, it } from 'vitest';
import { characterAvatar } from '#lib/core/avatars/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PlayersPhase } from '#lib/core/rules/game-phase.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	gameOver,
	join,
	lookLocked,
	newRoom,
	playerView,
	publish,
	reopenGame,
	seat,
	setLook,
	setName,
	unseat,
	type RoomState
} from './room.ts';

function table(now?: PlayersPhase): PublicGameState {
	return {
		seats: ['a', 'b'].map((id, i) => ({ seatId: id as SeatId, seatNumber: i + 1, dead: false })),
		today: { nominations: [], executions: [] },
		...(now ? { now } : {})
	};
}

const SETUP: PlayersPhase = { kind: 'setup' };
const NIGHT_1: PlayersPhase = { kind: 'night', number: 1 };
const imp = characterAvatar('imp');
const washerwoman = characterAvatar('washerwoman');

/** Alex, seated with the Washerwoman as their character token, in game g1's Setup. */
function inSetup(): RoomState {
	let room = join(publish(newRoom('hash'), 'g1', table(SETUP)), 'alex')!;
	room = seat(setName(room, 'alex', { name: 'Alex' }), 'alex', 'a');
	return setLook(room, 'alex', { avatar: washerwoman, frame: 'ring-accent' });
}

const alex = (room: RoomState) => room.members.find((m) => m.memberId === 'alex')!;

// Trevor, 2026-10-29: once a game has started, a player can't change the look on their seat,
// or it could hint at the character they are bluffing.
describe("a player's look during a game", () => {
	it('changes freely in Setup, then locks when the first night begins', () => {
		let room = inSetup();
		expect(lookLocked(room, alex(room))).toBe(false);
		room = setLook(room, 'alex', { avatar: imp });
		expect(alex(room).avatar).toBe(imp);

		room = publish(room, 'g1', table(NIGHT_1));
		expect(lookLocked(room, alex(room))).toBe(true);
		expect(playerView(room, 'alex').lookLocked).toBe(true);
		expect(setLook(room, 'alex', { avatar: washerwoman })).toBe(room);
	});

	it('stays locked while the board shows no phase, and on a later day', () => {
		let room = publish(inSetup(), 'g1', table(NIGHT_1));
		room = publish(room, 'g1', table());
		expect(lookLocked(room, alex(room))).toBe(true);
		room = publish(room, 'g1', table({ kind: 'day', number: 2 }));
		expect(setLook(room, 'alex', { avatar: imp })).toBe(room);
	});

	it('unlocks when the game ends, and again for a new game', () => {
		let room = publish(inSetup(), 'g1', table(NIGHT_1));
		room = gameOver(room, 'g1', 'good');
		expect(playerView(room, 'alex').lookLocked).toBeUndefined();
		expect(alex(setLook(room, 'alex', { avatar: imp })).avatar).toBe(imp);

		// Reopened, the game locks the look again.
		room = reopenGame(room, 'g1');
		expect(lookLocked(room, alex(room))).toBe(true);

		// A new game starts in Setup, unlocked, even before its board shows a phase.
		expect(lookLocked(publish(room, 'g2', table()), alex(room))).toBe(false);
		expect(publish(room, 'g2', table()).begun).toBeUndefined();
	});

	it('keeps a seated player with no look from picking one mid-game', () => {
		let room = join(publish(newRoom('hash'), 'g1', table(SETUP)), 'sam')!;
		room = seat(setName(room, 'sam', { name: 'Sam' }), 'sam', 'b');
		room = publish(room, 'g1', table(NIGHT_1));
		expect(setLook(room, 'sam', { avatar: imp })).toBe(room);
	});

	it('lets a phone joining mid-game set its look once', () => {
		let room = publish(inSetup(), 'g1', table(NIGHT_1));
		room = join(room, 'jo')!;
		expect(lookLocked(room, room.members[1])).toBe(false);
		room = setLook(room, 'jo', { avatar: imp });
		expect(room.members[1].avatar).toBe(imp);
		expect(setLook(room, 'jo', { avatar: washerwoman })).toBe(room);
	});

	it('keeps an unseated player from changing their look by leaving their seat', () => {
		let room = publish(inSetup(), 'g1', table(NIGHT_1));
		room = unseat(room, 'alex');
		expect(setLook(room, 'alex', { avatar: imp })).toBe(room);
	});
});
