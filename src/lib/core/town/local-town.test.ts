import { describe, expect, it } from 'vitest';
import {
	LOCAL_TOWN_MAX_SEATS,
	emptyTown,
	localPublicSeats,
	parseLocalTown,
	renameSeat,
	setDead,
	setTraveller,
	setVoteUsed,
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
});
