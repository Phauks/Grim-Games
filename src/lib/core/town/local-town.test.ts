import { describe, expect, it } from 'vitest';
import {
	LOCAL_TOWN_MAX_SEATS,
	emptyTown,
	localPublicSeats,
	moveSeat,
	parseLocalTown,
	placeSeats,
	renameSeat,
	setDead,
	setOffScript,
	setTraveller,
	setVoteUsed,
	startingTown,
	swapSeats,
	withSeatCount
} from './local-town.ts';

describe('local town', () => {
	it('adds seats on the end and drops the last ones', () => {
		const five = withSeatCount(emptyTown(), 5);
		expect(five.seats.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4', 's5']);
		const named = renameSeat(five, 's2', '  Ana  ');
		const three = withSeatCount(named, 3);
		expect(three.seats.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
		expect(three.seats[1].name).toBe('  Ana  ');
		expect(parseLocalTown(three).seats[1].name).toBe('Ana');
		// Seat ids stay unique after a seat in the middle was dropped from storage.
		const gap = parseLocalTown({ v: 1, seats: [{ id: 's1' }, { id: 's3' }] });
		expect(withSeatCount(gap, 3).seats.map((s) => s.id)).toEqual(['s1', 's3', 's4']);
		expect(withSeatCount(five, 999).seats).toHaveLength(LOCAL_TOWN_MAX_SEATS);
	});

	it('starts a town at seven seats', () => {
		// Trevor, 2026-11-06: "Seats should start at 7. No none setting".
		expect(startingTown().seats.map((s) => s.id)).toEqual([
			's1',
			's2',
			's3',
			's4',
			's5',
			's6',
			's7'
		]);
	});

	it('gives only the dead a ghost vote, and gives it back on coming alive', () => {
		let town = withSeatCount(emptyTown(), 5);
		town = setVoteUsed(town, 's1', true);
		expect(town.seats[0].voteUsed).toBeUndefined();
		town = setVoteUsed(setDead(town, 's1', true), 's1', true);
		expect(localPublicSeats(town)[0]).toMatchObject({ dead: true, ghostVote: 'used' });
		town = setDead(town, 's1', false);
		expect(localPublicSeats(town)[0]).toEqual({ seatId: 's1', seatNumber: 1, dead: false });
	});

	it('draws names, numbers and Travellers as a room sends them', () => {
		let town = withSeatCount(emptyTown(), 5);
		town = setTraveller(renameSeat(town, 's3', 'Jo'), 's3', 'gunslinger');
		town = setDead(town, 's4', true);
		const seats = localPublicSeats(town);
		expect(seats[2]).toEqual({
			seatId: 's3',
			seatNumber: 3,
			playerName: 'Jo',
			dead: false,
			traveller: 'gunslinger'
		});
		expect(seats[3]).toMatchObject({ dead: true, ghostVote: 'unused' });
		expect(localPublicSeats(setTraveller(town, 's3', undefined))[2].traveller).toBeUndefined();
	});

	it('reads anything stored as a town, dropping what it cannot use', () => {
		expect(parseLocalTown(undefined)).toEqual(emptyTown());
		expect(parseLocalTown('x')).toEqual(emptyTown());
		expect(
			parseLocalTown({
				v: 1,
				seats: [
					{ id: 's1', name: 'Sam', dead: true, voteUsed: true },
					{ id: 's1' },
					null,
					{ id: '' },
					{ id: 's2', voteUsed: true, name: '   ' }
				]
			}).seats
		).toEqual([{ id: 's1', name: 'Sam', dead: true, voteUsed: true }, { id: 's2' }]);
	});

	// Trevor, 2026-11-15: "In a local only grim, should be able to arrange tokens as desired".
	it('keeps where the player placed seats, for seats it still has', () => {
		const town = placeSeats(withSeatCount(emptyTown(), 5), {
			s2: { x: 10, y: 20 },
			gone: { x: 1, y: 1 }
		});
		expect(town.placed).toEqual({ s2: { x: 10, y: 20 } });
		expect(parseLocalTown(JSON.parse(JSON.stringify(town))).placed).toEqual(town.placed);
		// A seat dropped by the count takes its place with it; none left keeps nothing.
		expect(withSeatCount(town, 1).placed).toBeUndefined();
		expect(withSeatCount(town, 3).placed).toEqual({ s2: { x: 10, y: 20 } });
		expect(placeSeats(town, {}).placed).toBeUndefined();
		// Places off the board, or not numbers, are not read.
		const odd = parseLocalTown({
			v: 1,
			seats: [{ id: 's1' }, { id: 's2' }],
			placed: { s1: { x: 150, y: 5 }, s2: { x: '5', y: 5 } }
		});
		expect(odd.placed).toBeUndefined();
	});

	it('swaps two players, who keep their names and marks, and moves one along the table', () => {
		const town = setDead(renameSeat(withSeatCount(emptyTown(), 4), 's1', 'Ana'), 's4', true);
		const swapped = swapSeats(town, 's1', 's4');
		expect(swapped.seats.map((s) => s.id)).toEqual(['s4', 's2', 's3', 's1']);
		expect(localPublicSeats(swapped)[3]).toMatchObject({ seatId: 's1', playerName: 'Ana' });
		expect(localPublicSeats(swapped)[0]).toMatchObject({ seatId: 's4', seatNumber: 1, dead: true });
		expect(swapSeats(town, 's1', 'nobody')).toBe(town);
		expect(moveSeat(town, 's4', 1).seats.map((s) => s.id)).toEqual(['s1', 's4', 's2', 's3']);
		expect(moveSeat(town, 's1', 99).seats.map((s) => s.id)).toEqual(['s2', 's3', 's4', 's1']);
	});

	// Trevor, 2026-11-16: picked an Off-script toggle on the seat sheet, remembered per game.
	it('remembers the Off-script characters toggle, and only reads a true', () => {
		const on = setOffScript(withSeatCount(emptyTown(), 3), true);
		expect(on.offScript).toBe(true);
		expect(parseLocalTown(JSON.parse(JSON.stringify(on))).offScript).toBe(true);
		expect(withSeatCount(on, 5).offScript).toBe(true);
		expect('offScript' in setOffScript(on, false)).toBe(false);
		expect(parseLocalTown({ v: 1, seats: [], offScript: 'yes' }).offScript).toBeUndefined();
	});
});
