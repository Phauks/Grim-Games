import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	bankReminders,
	byLabel,
	stepReminders,
	parseReminderKey,
	reminderCopiesLeft,
	reminderGroups,
	reminderKey
} from './reminders.ts';

const data = committedGameData();
const script = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, script);
let n = 0;
const ctx: EngineContext = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };

function game() {
	let session = createGame({ type: 'CreateGame', script, playerCount: 5 }, ctx);
	if (!session.ok) throw new Error();
	const seat = session.session.game.seating[0];
	session = dispatch(
		session.session,
		{ type: 'AssignCharacter', seatId: seat, characterId: 'poisoner' },
		ctx
	);
	if (!session.ok) throw new Error();
	return session.session.game;
}

describe('reminderGroups', () => {
	// https://wiki.bloodontheclocktower.com/Drunk : "Is The Drunk" is a global reminder.
	it('offers characters in play, and only global reminders of the rest, in script order', () => {
		const groups = reminderGroups(game(), characters);
		const ids = groups.map((g) => g.character.id);
		// Trouble Brewing lists the Drunk (an Outsider) before the Poisoner (a Minion).
		expect(ids.indexOf('drunk')).toBeLessThan(ids.indexOf('poisoner'));
		expect(groups.find((g) => g.character.id === 'poisoner')?.labels).toEqual(['Poisoned']);
		const drunk = groups.find((g) => g.character.id === 'drunk');
		expect(drunk?.labels).toEqual(['Is The Drunk']);
		expect(groups.some((g) => g.character.id === 'washerwoman')).toBe(false);
	});
	it('counts a true character under another token as in play', () => {
		let g = game();
		const seat = g.seating[1];
		for (const command of [
			{ type: 'AssignCharacter', seatId: seat, characterId: 'washerwoman' },
			{
				type: 'AddReminder',
				seatId: seat,
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}
		] as const) {
			const result = dispatch({ log: { entries: [], cursor: 0 }, game: g }, command, ctx);
			if (!result.ok) throw new Error(result.error.message);
			g = result.session.game;
		}
		const groups = reminderGroups(g, characters);
		expect(groups.find((x) => x.character.id === 'washerwoman')?.labels).toEqual([
			'Townsfolk',
			'Wrong'
		]);
		expect(groups.some((x) => x.character.id === 'drunk')).toBe(true);
		expect(groups.some((x) => x.character.id === 'chef')).toBe(false);
	});
});

describe('reminderCopiesLeft', () => {
	// Reminder tokens come in the numbers TPI lists them: "Poisoned" once per Poisoner.
	it('uses a token up once placed, and gives a second Poisoner its own', () => {
		let g = game();
		const key = reminderKey({ characterId: 'poisoner', label: 'Poisoned' });
		expect(reminderCopiesLeft(g, characters).get(key)).toBe(1);
		const run = (command: Parameters<typeof dispatch>[1]) => {
			const result = dispatch({ log: { entries: [], cursor: 0 }, game: g }, command, ctx);
			if (!result.ok) throw new Error(result.error.message);
			g = result.session.game;
		};
		run({
			type: 'AddReminder',
			seatId: g.seating[2],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		});
		expect(reminderCopiesLeft(g, characters).get(key)).toBe(0);
		run({ type: 'AssignCharacter', seatId: g.seating[3], characterId: 'poisoner' });
		expect(reminderCopiesLeft(g, characters).get(key)).toBe(1);
	});
});

describe('bankReminders', () => {
	const run = (g: ReturnType<typeof game>, command: Parameters<typeof dispatch>[1]) => {
		const result = dispatch({ log: { entries: [], cursor: 0 }, game: g }, command, ctx);
		if (!result.ok) throw new Error(result.error.message);
		return result.session.game;
	};
	it('holds every reminder still off the board, and loses one once it is placed', () => {
		let g = game();
		const poisoned = { characterId: 'poisoner', label: 'Poisoned', left: 1, now: false };
		expect(bankReminders(g, characters)).toContainEqual(poisoned);
		g = run(g, {
			type: 'AddReminder',
			seatId: g.seating[2],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		});
		expect(bankReminders(g, characters)).not.toContainEqual(poisoned);
	});
	it("puts the walked-through character's reminders first", () => {
		let g = game();
		g = run(g, { type: 'AssignCharacter', seatId: g.seating[1], characterId: 'monk' });
		// Script order otherwise: the Monk (a Townsfolk) before the Poisoner.
		expect(bankReminders(g, characters)[0].characterId).toBe('monk');
		expect(bankReminders(g, characters)[0].now).toBe(false);
		expect(bankReminders(g, characters, stepReminders('monk', 'other'))[0]).toMatchObject({
			characterId: 'monk',
			label: 'Safe',
			now: true
		});
	});
	// https://wiki.bloodontheclocktower.com/Grandmother : her grandchild's death kills her,
	// which can only happen after the first night.
	it('marks only the reminders the step can use that night', () => {
		expect(stepReminders('grandmother', 'first').labels).toEqual([]);
		expect(stepReminders('grandmother', 'other').labels).toEqual(['Dead']);
	});
});

describe('byLabel', () => {
	it('sorts names alphabetically, with numbers in order', () => {
		expect(['Drunk 10', 'Wrong', 'Drunk 2', 'drunk 1'].sort(byLabel)).toEqual([
			'drunk 1',
			'Drunk 2',
			'Drunk 10',
			'Wrong'
		]);
	});
});

describe('reminderKey', () => {
	it('round-trips and ignores junk', () => {
		const r = { characterId: 'drunk', label: 'Is The Drunk' };
		expect(parseReminderKey(reminderKey(r))).toEqual(r);
		expect(parseReminderKey('nope')).toBeUndefined();
	});
});
