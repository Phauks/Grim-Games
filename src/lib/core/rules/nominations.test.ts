/** Today's nominations, from the day log (https://wiki.bloodontheclocktower.com/Glossary, "Nomination"). */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame } from '#lib/core/model/fixtures.test-support.ts';
import { seatNominations, todaysNominations } from './nominations.ts';

const nominate =
	(by: number, who: number) =>
	(s: string[]): Command => ({ type: 'Nominate', nominator: s[by], nominee: s[who] });

describe('todaysNominations', () => {
	it('lists who nominated whom today, in order', () => {
		const { session, seats } = castGame(['chef', 'empath', 'imp'], nominate(0, 2), nominate(1, 0));
		expect(todaysNominations(session.game)).toMatchObject([
			{ nominator: seats[0], nominee: seats[2] },
			{ nominator: seats[1], nominee: seats[0] }
		]);
	});

	it('starts afresh each day', () => {
		const { session } = castGame(['chef', 'imp'], nominate(0, 1), { type: 'NewDay' });
		expect(todaysNominations(session.game)).toEqual([]);
	});
});

describe('seatNominations', () => {
	it('gives a seat the nomination it made and the one it received today', () => {
		const { session, seats } = castGame(['chef', 'empath', 'imp'], nominate(0, 2), nominate(2, 1));
		expect(seatNominations(session.game, seats[2])).toMatchObject({
			made: { nominator: seats[2], nominee: seats[1] },
			received: { nominator: seats[0], nominee: seats[2] }
		});
		expect(seatNominations(session.game, seats[1])).toMatchObject({
			received: { nominator: seats[2] }
		});
		expect(seatNominations(session.game, seats[1]).made).toBeUndefined();
	});
});
