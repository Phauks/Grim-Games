import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup, GENERIC_REMINDER_ID } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { bankItems, type BankOptions } from './bank-items.ts';

const data = committedGameData();
const script = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, script);
let n = 0;
const ctx: EngineContext = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };

/** A five-player game with a Poisoner on the first seat. */
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

const options: BankOptions = {
	focus: undefined,
	focusMode: 'front',
	stack: false,
	copies: new Set(),
	bankCopies: new Map()
};

describe('bankItems', () => {
	it('lists the reminders, then the generic ∞ and + New token', () => {
		const items = bankItems(game(), characters, options);
		const groups = [...new Set(items.map((i) => i.group))];
		expect(groups).toEqual(['reminders', 'generic']);
		expect(items.filter((i) => i.characterId === 'poisoner').length).toBeGreaterThan(0);
		expect(items.at(-2)).toMatchObject({ characterId: GENERIC_REMINDER_ID, key: 'generic' });
		expect(items.at(-1)).toMatchObject({ key: 'new-token', makesToken: true });
	});

	it('keeps only the walked step and the ∞ tokens under "Only this character"', () => {
		const items = bankItems(game(), characters, {
			...options,
			focus: { characterId: 'washerwoman', labels: ['Townsfolk'] },
			focusMode: 'only'
		});
		expect(items.every((i) => i.now || i.group === 'generic')).toBe(true);
		expect(items.some((i) => i.characterId === 'poisoner')).toBe(false);
	});
});
