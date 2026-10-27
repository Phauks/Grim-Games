import { describe, expect, it } from 'vitest';
import type { SeatId } from '#lib/core/model/index.ts';
import { seatChanges, seatsToName } from './room-seating.ts';

const s = (id: string) => id as SeatId;
const seats = (...names: (string | undefined)[]) =>
	names.map((playerName, i) => ({ seatId: s(`s${i + 1}`), playerName }));

describe('seating phones by name', () => {
	it('seats a phone where its name is, ignoring case and spaces', () => {
		const members = [{ memberId: 'a', name: 'Alex  Kim' }, { memberId: 'b' }];
		expect(seatChanges(members, seats('Sam', ' alex kim'))).toEqual([
			{ memberId: 'a', seatId: 's2' }
		]);
	});

	it('changes nothing for a phone already in its seat', () => {
		const members = [{ memberId: 'a', name: 'Alex', seatId: s('s1') }];
		expect(seatChanges(members, seats('Alex'))).toEqual([]);
	});

	it('moves a phone whose seat was renamed, and unseats one whose name is on no seat', () => {
		const members = [
			{ memberId: 'a', name: 'Alex', seatId: s('s1') },
			{ memberId: 'b', name: 'Sam', seatId: s('s2') }
		];
		expect(seatChanges(members, seats('Kim', 'Alex'))).toEqual([
			{ memberId: 'a', seatId: 's2' },
			{ memberId: 'b' }
		]);
	});

	it('gives a seat to one phone when two share its name, preferring the one here', () => {
		const members = [
			{ memberId: 'old', name: 'Alex' },
			{ memberId: 'new', name: 'Alex' }
		];
		expect(seatChanges(members, seats('Alex'), (id) => id === 'new')).toEqual([
			{ memberId: 'new', seatId: 's1' }
		]);
		const seated = [{ ...members[0], seatId: s('s1') }, members[1]];
		expect(seatChanges(seated, seats('Alex'), (id) => id === 'new')).toEqual([]);
		// Two seats with the name seat both phones.
		expect(seatChanges(members, seats('Alex', 'Alex'))).toEqual([
			{ memberId: 'old', seatId: 's1' },
			{ memberId: 'new', seatId: 's2' }
		]);
	});
});

describe('naming seats for phones', () => {
	it('puts each named phone on the first unnamed seat, in join order', () => {
		const members = [
			{ memberId: 'a', name: 'Phone' },
			{ memberId: 'b' },
			{ memberId: 'c', name: 'Sam' }
		];
		expect(seatsToName(members, seats('Kim', undefined, undefined))).toEqual([
			{ memberId: 'a', seatId: 's2', playerName: 'Phone' },
			{ memberId: 'c', seatId: 's3', playerName: 'Sam' }
		]);
	});

	it('leaves a phone whose name is already on a seat', () => {
		expect(seatsToName([{ memberId: 'a', name: 'alex' }], seats('Alex', undefined))).toEqual([]);
	});

	it('names no seat once every seat has a name, and never one name twice', () => {
		const twins = [
			{ memberId: 'a', name: 'Alex' },
			{ memberId: 'b', name: 'Alex' }
		];
		expect(seatsToName(twins, seats(undefined, undefined))).toEqual([
			{ memberId: 'a', seatId: 's1', playerName: 'Alex' }
		]);
		expect(seatsToName([{ memberId: 'a', name: 'Alex' }], seats('Kim'))).toEqual([]);
	});
});
