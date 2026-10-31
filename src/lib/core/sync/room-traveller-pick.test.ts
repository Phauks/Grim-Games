import { describe, expect, it } from 'vitest';
import type { CharacterId } from '#lib/core/data/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { PublicGameState } from './public-projection.ts';
import {
	closeTravellerPick,
	confirmTraveller,
	holdTraveller,
	hostView,
	join,
	newRoom,
	openTravellerPick,
	playerView,
	publish,
	seat,
	setName,
	setTravellerFor,
	type RoomState
} from './room.ts';

// Trevor, 2026-10-31: Travellers choose on their phones. The player picks the Traveller and
// the Storyteller its alignment (https://wiki.bloodontheclocktower.com/Glossary, "Traveller");
// everyone choosing sees the same list, a tap holds one so no one else can take it, and
// Confirm locks it in.

const s = (id: string) => id as SeatId;
const c = (id: string) => id as CharacterId;
const OPTIONS = ['scapegoat', 'gunslinger', 'beggar', 'bureaucrat', 'thief'];

function table(count: number): PublicGameState {
	return {
		seats: Array.from({ length: count }, (_, i) => ({
			seatId: s(`s${i + 1}`),
			seatNumber: i + 1,
			dead: false,
			...(i === 3 ? { playerName: 'Dee' } : {})
		})),
		today: { nominations: [], executions: [] }
	} as PublicGameState;
}

/** Four seats: Sam in s1, Ana in s2, Bo (not choosing) in s3, Dee with no phone in s4. */
function room(): RoomState {
	let r = publish(newRoom('hash'), 'g1', table(4));
	for (const [id, name, seatId] of [
		['sam', 'Sam', 's1'],
		['ana', 'Ana', 's2'],
		['bo', 'Bo', 's3']
	]) {
		r = seat(setName(join(r, id)!, id, { name }), id, seatId);
	}
	return openTravellerPick(r, 'g1', 'p1', OPTIONS, ['s1', 's2', 's4']);
}

describe('Travellers choose on their phones', () => {
	it('shows the choice only to the seats choosing', () => {
		const r = room();
		expect(playerView(r, 'sam').travellerPick).toEqual({
			pickId: 'p1',
			options: OPTIONS,
			held: {}
		});
		expect(playerView(r, 'bo').travellerPick).toBeUndefined();
		expect(hostView(r).travellerPick?.seats.map((x) => x.seatId)).toEqual(['s1', 's2', 's4']);
	});

	it('holds a tapped Traveller so no other phone can take it', () => {
		let r = holdTraveller(room(), 'sam', 'p1', 'scapegoat');
		// Ana taps the same one a moment later: the first tap holds it.
		r = holdTraveller(r, 'ana', 'p1', 'scapegoat');
		expect(playerView(r, 'sam').travellerPick?.mine).toBe('scapegoat');
		expect(playerView(r, 'ana').travellerPick?.mine).toBeUndefined();
		expect(playerView(r, 'ana').travellerPick?.held).toEqual({ scapegoat: 'Sam' });
	});

	it('lets a phone change its mind until it confirms', () => {
		let r = holdTraveller(room(), 'sam', 'p1', 'scapegoat');
		r = holdTraveller(r, 'sam', 'p1', 'thief');
		expect(playerView(r, 'ana').travellerPick?.held).toEqual({ thief: 'Sam' });
		r = holdTraveller(r, 'ana', 'p1', 'scapegoat');
		expect(playerView(r, 'ana').travellerPick?.mine).toBe('scapegoat');
		r = confirmTraveller(r, 'sam', 'p1');
		expect(playerView(r, 'sam').travellerPick).toMatchObject({ mine: 'thief', confirmed: true });
		// Locked: a later tap or a let-go changes nothing.
		expect(holdTraveller(r, 'sam', 'p1', 'beggar')).toBe(r);
		expect(holdTraveller(r, 'sam', 'p1', null)).toBe(r);
		expect(hostView(r).travellerPick?.seats[0]).toEqual({
			seatId: 's1',
			characterId: 'thief',
			confirmed: true
		});
	});

	it('ignores taps outside the choice', () => {
		const r = room();
		expect(holdTraveller(r, 'bo', 'p1', 'scapegoat')).toBe(r);
		expect(holdTraveller(r, 'sam', 'old', 'scapegoat')).toBe(r);
		expect(holdTraveller(r, 'sam', 'p1', 'harlot')).toBe(r);
		expect(confirmTraveller(r, 'sam', 'p1')).toBe(r);
	});

	it('lets the Storyteller pick for a player without a phone, and let a hold go', () => {
		let r = holdTraveller(room(), 'sam', 'p1', 'scapegoat');
		// Not a Traveller another seat holds.
		expect(setTravellerFor(r, 's4', 'scapegoat')).toBe(r);
		r = setTravellerFor(r, 's4', 'beggar');
		expect(playerView(r, 'ana').travellerPick?.held).toEqual({ scapegoat: 'Sam', beggar: 'Dee' });
		expect(hostView(r).travellerPick?.seats[2]).toEqual({
			seatId: 's4',
			characterId: 'beggar',
			confirmed: true
		});
		r = setTravellerFor(r, 's1', null);
		expect(playerView(r, 'sam').travellerPick?.mine).toBeUndefined();
	});

	it('keeps holds that still fit when sent again, and closes with a new game', () => {
		let r = holdTraveller(room(), 'sam', 'p1', 'scapegoat');
		r = holdTraveller(r, 'ana', 'p1', 'thief');
		r = openTravellerPick(r, 'g1', 'p2', ['scapegoat', 'harlot'], ['s1', 's2', 's3']);
		expect(playerView(r, 'sam').travellerPick?.mine).toBe('scapegoat');
		expect(playerView(r, 'ana').travellerPick?.mine).toBeUndefined();
		expect(playerView(r, 'bo').travellerPick?.options).toEqual(['scapegoat', 'harlot']);
		expect(closeTravellerPick(r).travellerPick).toBeUndefined();
		expect(publish(r, 'g2', table(4)).travellerPick).toBeUndefined();
	});

	it('opens nothing for another game, no seats or no Travellers', () => {
		const r = publish(newRoom('hash'), 'g1', table(2));
		expect(openTravellerPick(r, 'g0', 'p', OPTIONS, ['s1'])).toBe(r);
		expect(openTravellerPick(r, 'g1', 'p', OPTIONS, ['nope'])).toBe(r);
		expect(openTravellerPick(r, 'g1', 'p', [], ['s1'])).toBe(r);
		expect(openTravellerPick(r, 'g1', 'p', [c('scapegoat')], ['s1']).travellerPick?.seats).toEqual([
			's1'
		]);
	});
});
