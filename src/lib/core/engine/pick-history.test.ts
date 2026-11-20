import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { pickHistory } from './pick-history.ts';

const know = { characterId: 'balloonist', label: 'Know' };
const cast = ['balloonist', 'chef', 'empath', 'butler', 'imp'];
const seatsAndNights = (picks: readonly { seatId: string; night: number }[]) =>
	picks.map((p) => ({ seatId: p.seatId, night: p.night }));

describe('pickHistory', () => {
	it('lists each pick in the order made, with its night', () => {
		const s = scenario(cast)
			.reminder('chef', 'balloonist', 'Know')
			.newDay()
			.dusk()
			.moves('balloonist', 'Know', 'butler')
			.newDay()
			.dusk();
		const past = s.pastPicks();
		expect(past.tonight).toBe(3);
		expect(seatsAndNights(past.of(know))).toEqual([
			{ seatId: s.seat('chef'), night: 1 },
			{ seatId: s.seat('butler'), night: 2 }
		]);
	});

	it('leaves out tonight’s picks', () => {
		const s = scenario(cast)
			.reminder('chef', 'balloonist', 'Know')
			.newDay()
			.dusk()
			.moves('balloonist', 'Know', 'butler');
		expect(seatsAndNights(s.pastPicks().of(know))).toEqual([{ seatId: s.seat('chef'), night: 1 }]);
	});

	it('counts a copy moved twice in one night once, where it ended up', () => {
		const s = scenario(cast)
			.reminder('chef', 'balloonist', 'Know')
			.moves('balloonist', 'Know', 'empath')
			.newDay()
			.dusk();
		expect(
			s
				.pastPicks()
				.of(know)
				.map((p) => p.seatId)
		).toEqual([s.seat('empath')]);
	});

	it('keeps each copy of a character apart when the token names its owner', () => {
		const s = scenario(cast).reminder('chef', 'balloonist', 'Know').newDay().dusk();
		expect(s.pastPicks().of({ ...know, ownerSeatId: s.seat('empath') })).toEqual([]);
		expect(s.pastPicks().of(know)).toHaveLength(1);
	});

	it('ignores undone picks', () => {
		const s = scenario(cast).reminder('chef', 'balloonist', 'Know').newDay();
		const undone = { ...s.session.log, cursor: 1 };
		expect(pickHistory(undone).of(know)).toEqual([]);
	});

	it('keeps the character a picked player had then', () => {
		const s = scenario(cast)
			.reminder('chef', 'balloonist', 'Know')
			.newDay()
			.becomes('chef', 'imp')
			.dusk();
		const [pick] = s.pastPicks().of(know);
		expect(pick.game.seats[pick.seatId].characterId).toBe('chef');
	});
});
