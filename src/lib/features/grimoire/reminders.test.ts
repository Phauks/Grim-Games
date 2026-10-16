import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { parseReminderKey, reminderGroups, reminderKey } from './reminders.ts';

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
	it('offers characters in play first, then only global reminders of the rest', () => {
		const groups = reminderGroups(game(), characters);
		expect(groups[0]).toMatchObject({ character: { id: 'poisoner' }, labels: ['Poisoned'] });
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

describe('reminderKey', () => {
	it('round-trips and ignores junk', () => {
		const r = { characterId: 'drunk', label: 'Is The Drunk' };
		expect(parseReminderKey(reminderKey(r))).toEqual(r);
		expect(parseReminderKey('nope')).toBeUndefined();
	});
});
