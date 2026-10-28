/**
 * Show to player records what was shown and places its reminders. The Washerwoman's tokens
 * follow https://wiki.bloodontheclocktower.com/Washerwoman (one of two players is the
 * Townsfolk shown); the Village Idiot's answer https://wiki.bloodontheclocktower.com/Village_Idiot.
 */
import { describe, expect, it } from 'vitest';
import {
	castGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { infoPicker } from '#lib/core/rules/index.ts';
import { shownCommands } from './record-shown.ts';

describe('shownCommands', () => {
	it('records a shown pair and places the reminders it calls for', () => {
		const { game: g, seats } = castGame(['washerwoman', 'chef', 'imp', 'butler']);
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		const [command] = shownCommands(g, characters, picker, {
			seats: [seats[1], seats[3]],
			characterId: 'chef'
		});
		if (command?.type !== 'RecordNightInfo') throw new Error('expected a record');
		expect(command).toMatchObject({
			type: 'RecordNightInfo',
			seatId: seats[0],
			characterId: 'washerwoman'
		});
		expect(command.reminders?.map((r) => [r.seatId, r.reminder.label])).toEqual([
			[seats[1], 'Townsfolk'],
			[seats[3], 'Wrong']
		]);
		expect(command.abnormal).toBeUndefined();
	});

	it('leaves out reminders already on the board, and records the same thing once', () => {
		const first = castGame(['washerwoman', 'chef', 'imp', 'butler'], (s) => ({
			type: 'AddReminder',
			seatId: s[1],
			reminder: { characterId: 'washerwoman', label: 'Townsfolk' }
		}));
		const { seats } = first;
		const choice = { seats: [seats[1], seats[3]], characterId: 'chef' };
		const picker = infoPicker(first.game, seats[0], 'washerwoman', characters)!;
		const [command] = shownCommands(first.game, characters, picker, choice);
		if (command?.type !== 'RecordNightInfo') throw new Error('expected a record');
		expect(command.reminders?.map((r) => r.reminder.label)).toEqual(['Wrong']);
		const next = run(first.session, first.ctx, command);
		const again = infoPicker(next.game, seats[0], 'washerwoman', characters)!;
		expect(shownCommands(next.game, characters, again, choice)).toEqual([]);
	});

	it('records a chosen player’s alignment in words', () => {
		const { game: g, seats } = castGame(['villageidiot', 'chef', 'imp']);
		const picker = infoPicker(g, seats[0], 'villageidiot', characters)!;
		expect(shownCommands(g, characters, picker, { seats: [seats[2]], yes: true })).toMatchObject([
			{ type: 'RecordNightInfo', text: 'Chose Cat: shown evil' }
		]);
	});

	it('only places the shown player’s reminder while a pair’s second player is unknown', () => {
		const { game: g, seats } = castGame(['washerwoman', 'chef', 'imp', 'butler']);
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		expect(
			shownCommands(g, characters, picker, { seats: [seats[1]], characterId: 'chef' })
		).toEqual([
			{
				type: 'AddReminder',
				seatId: seats[1],
				reminder: { characterId: 'washerwoman', label: 'Townsfolk' }
			}
		]);
	});
});
