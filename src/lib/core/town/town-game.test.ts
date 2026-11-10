import { describe, expect, it } from 'vitest';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { testCharacters, testScript } from '#lib/core/model/fixtures.test-support.ts';
import { townGame } from './town-game.ts';

// A player's grim read as a Game, so the board's reminder rules mark its seats as they mark the
// Storyteller's (Trevor, 2026-11-10: Local Grim should match the Storyteller).
describe('townGame', () => {
	const game = townGame(
		testScript,
		[
			{ seatId: 'a', characterId: 'monk' },
			{ seatId: 'b', characterId: 'poisoner', dead: true },
			{ seatId: 'c' }
		],
		testCharacters
	);

	it('seats each shown character with its starting alignment, in order', () => {
		expect(game.seating).toEqual(['a', 'b', 'c']);
		expect(game.seats.a).toMatchObject({ characterId: 'monk', alignment: 'good', dead: false });
		expect(game.seats.b).toMatchObject({ characterId: 'poisoner', alignment: 'evil', dead: true });
		expect(game.seats.c.characterId).toBeUndefined();
		expect(game.seats.c.alignment).toBeUndefined();
	});

	it('lets the Red Herring fit a good seat, not an evil one, and any unknown seat', () => {
		// https://wiki.bloodontheclocktower.com/Fortune_Teller#How_to_Run
		// Wiki: "While preparing the first night, put the Fortune Teller's RED HERRING reminder
		// token by any good character token, marking that player as the Red Herring."
		const reminder = { characterId: 'fortuneteller', label: 'Red Herring' };
		expect(reminderTargetMisses(game, reminder, 'a', testCharacters)).toEqual([]);
		expect(reminderTargetMisses(game, reminder, 'b', testCharacters)).toEqual(['alignment']);
		expect(reminderTargetMisses(game, reminder, 'c', testCharacters)).toEqual([]);
	});
});
