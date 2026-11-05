import { describe, expect, it } from 'vitest';
import { editionScript, toScript, type Script } from '#lib/core/data/index.ts';
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
		// Or the number picked in its pill while held (plan M48).
		expect(bankLook(number, 4)).toEqual({ symbol: '#4' });
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

describe('counting runs in the bank (plan M53)', () => {
	// Trevor (2026-11-04): "should we also bundle incrementing reminder tokens together in the
	// bank?" Each run is one token, the next still off the board; the pulled-up bank has them all.
	const levScript: Script = {
		entries: ['leviathan', 'chef', 'empath', 'monk', 'soldier'].map((id) => ({
			kind: 'official' as const,
			id
		}))
	};
	const lev = characterLookup(data, levScript);
	const levCtx: EngineContext = { ...ctx, characters: lev };

	function withLeviathan(...labels: string[]) {
		let made = createGame({ type: 'CreateGame', script: levScript, playerCount: 5 }, levCtx);
		if (!made.ok) throw new Error();
		const seat = made.session.game.seating[0];
		made = dispatch(
			made.session,
			{ type: 'AssignCharacter', seatId: seat, characterId: 'leviathan' },
			levCtx
		);
		for (const label of labels) {
			if (!made.ok) throw new Error();
			made = dispatch(
				made.session,
				{ type: 'AddReminder', seatId: seat, reminder: { characterId: 'leviathan', label } },
				levCtx
			);
		}
		if (!made.ok) throw new Error();
		return made.session.game;
	}
	const days = (items: ReturnType<typeof bankItems>) =>
		items
			.filter((i) => i.characterId === 'leviathan' && i.label.startsWith('Day'))
			.map((i) => i.label);

	it('shows only the next day token while bundled', () => {
		const g = withLeviathan('Day 1');
		expect(days(bankItems(g, lev, { ...options, bundleCounters: true }))).toEqual(['Day 2']);
		expect(days(bankItems(g, lev, options))).toEqual(['Day 2', 'Day 3', 'Day 4', 'Day 5']);
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
