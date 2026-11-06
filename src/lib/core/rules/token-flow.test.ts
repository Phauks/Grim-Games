/**
 * Tokens that take each other's place (Trevor, 2026-11-06: "placing has should request taking
 * mad off").
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Pixie,
 * https://wiki.bloodontheclocktower.com/Shabaloth, https://wiki.bloodontheclocktower.com/Pukka
 */
import { describe, expect, it } from 'vitest';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { replacedByFlow } from './token-flow.ts';

/** The labels the latest `label` of `characterId` on `on` takes the place of. */
const replaced = (s: Scenario, on: string, characterId: string, label: string) => {
	const seatId = s.seat(on);
	const placed = s.game.seats[seatId].reminders.filter(
		(r) => r.characterId === characterId && r.label === label
	);
	return replacedByFlow(s.game, seatId, placed[placed.length - 1], s.characters).map(
		(r) => r.label
	);
};

describe('replacedByFlow', () => {
	it("takes the Pixie's Mad off when Has Ability goes on", () => {
		// Wiki: "If the Townsfolk marked MAD dies, and you feel that the Pixie player has been
		// sufficiently mad that they were this character, replace the MAD reminder with the HAS
		// ABILITY reminder."
		const s = scenario(['pixie', 'monk', 'chef', 'imp', 'poisoner'])
			.reminder('monk', 'pixie', 'Mad')
			.dies('monk', 'execution')
			.reminder('monk', 'pixie', 'Has Ability');
		expect(replaced(s, 'monk', 'pixie', 'Has Ability')).toEqual(['Mad']);
	});

	it("takes the Shabaloth's Dead off when Alive goes on", () => {
		// Wiki: "the chosen player becomes alive again—replace the DEAD reminder with the
		// Shabaloth’s ALIVE reminder, and remove their shroud."
		const s = scenario(['shabaloth', 'monk', 'chef', 'empath', 'poisoner'])
			.reminder('monk', 'shabaloth', 'Dead')
			.reminder('monk', 'shabaloth', 'Alive');
		expect(replaced(s, 'monk', 'shabaloth', 'Alive')).toEqual(['Dead']);
	});

	it("takes the Pukka's Poisoned off when Dead goes on", () => {
		// Wiki: "Each night except the first, the other player marked POISONED dies—mark them with
		// a DEAD reminder, then remove their POISONED reminder."
		const s = scenario(['pukka', 'monk', 'chef', 'empath', 'poisoner'])
			.reminder('monk', 'pukka', 'Poisoned')
			.reminder('monk', 'pukka', 'Dead');
		expect(replaced(s, 'monk', 'pukka', 'Dead')).toEqual(['Poisoned']);
	});

	it('takes nothing off for the first token, or from another player', () => {
		const s = scenario(['pukka', 'monk', 'chef', 'empath', 'poisoner'])
			.reminder('monk', 'pukka', 'Poisoned')
			.reminder('chef', 'pukka', 'Dead');
		expect(replaced(s, 'chef', 'pukka', 'Dead')).toEqual([]);
		expect(replaced(s, 'monk', 'pukka', 'Poisoned')).toEqual([]);
	});
});
