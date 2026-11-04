import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import { placeLabSetup } from './lab-setup.ts';

// The Character Lab (M37) places the setup reminders a Storyteller would before Start game.

/** A repeatable stand-in for Math.random. */
const seeded = (seed = 1) => {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return (s - 1) / 2147483646;
	};
};

describe('placeLabSetup', () => {
	// https://wiki.bloodontheclocktower.com/Fortune_Teller
	it("puts the Fortune Teller's Red Herring on a good player", () => {
		// Wiki: "put the Fortune Teller's RED HERRING reminder token by any good character token"
		for (const seed of [1, 2, 3, 4]) {
			const s = scenario(['fortuneteller', 'chef', 'empath', 'imp', 'poisoner']);
			const placed = placeLabSetup(
				s.game,
				s.characters,
				({ seatId, reminder }) => s.do({ type: 'AddReminder', seatId, reminder }).game,
				seeded(seed)
			);
			const herring = placed.filter((p) => p.reminder.label === 'Red Herring');
			expect(herring).toHaveLength(1);
			const on = trueCharacter(s.game, herring[0].seatId, s.characters);
			expect(['fortuneteller', 'chef', 'empath']).toContain(on);
		}
	});

	it('places nothing when no setup token is needed', () => {
		const s = scenario(['chef', 'empath', 'monk', 'imp', 'poisoner']);
		const placed = placeLabSetup(s.game, s.characters, () => s.game);
		expect(placed).toEqual([]);
	});
});
