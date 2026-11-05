import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup, GENERIC_REMINDER_ID } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { bankFace, bankItems, bankLook, type BankOptions } from './bank-items.ts';

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
	it('lists the reminders, then the generic ∞, the # token and + New token', () => {
		const items = bankItems(game(), characters, options);
		const groups = [...new Set(items.map((i) => i.group))];
		expect(groups).toEqual(['reminders', 'generic']);
		expect(items.filter((i) => i.characterId === 'poisoner').length).toBeGreaterThan(0);
		expect(items.at(-3)).toMatchObject({ characterId: GENERIC_REMINDER_ID, key: 'generic' });
		// The # token, only for numbers (plan M35): a copy lands showing 1.
		const number = items.at(-2)!;
		expect(number).toMatchObject({ characterId: GENERIC_REMINDER_ID, number: true });
		expect(bankFace(number)).toEqual({ symbol: '#' });
		expect(bankLook(number)).toEqual({ symbol: '#1' });
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

describe('bankItems with borrowed abilities (M50)', () => {
	it("offers a gained character's reminders, with the living while someone living has it", () => {
		// Wiki (https://wiki.bloodontheclocktower.com/Philosopher): "During the first night, the
		// Philosopher chooses to gain the Dreamer's ability. They gain the Dreamer's ability from
		// now on and act when the Dreamer normally acts."
		const s = scenario(['philosopher', 'monk', 'chef', 'witch', 'nodashii']);
		const dead = s.dies('monk');
		const monkGroup = (game: typeof s.game) =>
			bankItems(game, s.characters, options).find((i) => i.characterId === 'monk')?.group;
		expect(monkGroup(dead.game)).toBe('dead');
		const gained = dead.do((x) => ({
			type: 'GiveAbility',
			seatId: x.seat('philosopher'),
			ability: { characterId: 'monk', via: 'philosopher' }
		}));
		expect(monkGroup(gained.game)).toBe('reminders');
	});

	it('offers the reminders of a character no one is, once someone has its ability', () => {
		const s = scenario(['chef', 'imp', 'empath', 'poisoner', 'saint']);
		const has = (game: typeof s.game) =>
			bankItems(game, s.characters, options).some(
				(i) => i.characterId === 'monk' && i.label === 'Safe'
			);
		expect(has(s.game)).toBe(false);
		const given = s.do((x) => ({
			type: 'GiveAbility',
			seatId: x.seat('chef'),
			ability: { characterId: 'monk' }
		}));
		expect(has(given.game)).toBe(true);
	});
});
