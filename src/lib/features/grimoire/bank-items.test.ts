import { describe, expect, it } from 'vitest';
import { editionScript, toScript, type Script } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup, GENERIC_REMINDER_ID } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import {
	FIXED_GENERIC_ITEMS,
	bankFace,
	bankItems,
	bankLabel,
	bankLook,
	playerBankItems,
	type BankOptions
} from './bank-items.ts';

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
	// bank?" Each run is one stacked token, the next still off the board on top.
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

	it('stacks the run as one token, the next day on top', () => {
		// Trevor (2026-11-06): "Counting reminders also refers to stacking those reminders on top
		// of each other in the bin".
		const items = bankItems(withLeviathan('Day 1'), lev, options);
		expect(days(items)).toEqual(['Day 2']);
		expect(items.find((i) => i.label === 'Day 2')?.count).toBe(4);
		const last = bankItems(withLeviathan('Day 1', 'Day 2', 'Day 3', 'Day 4'), lev, options);
		expect(last.find((i) => i.label === 'Day 5')?.count).toBe(1);
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

describe('each holder has its own copies (M68)', () => {
	const owners = (
		s: { game: Parameters<typeof bankItems>[0]; characters: Parameters<typeof bankItems>[1] },
		characterId: string,
		label: string
	) =>
		bankItems(s.game, s.characters, options)
			.filter((i) => i.characterId === characterId && i.label === label)
			.map((i) => i.ownerSeatId);

	it("gives the Hermit its own Master beside the Butler's, and never the 1, 2 and 3", () => {
		// Wiki (https://wiki.bloodontheclocktower.com/Hermit): "If the Hermit duplicates an in-play
		// Outsider, use the Hermit’s 1, 2 and 3 reminders instead."
		// Trevor (2026-11-06) replaced the 1, 2 and 3 with the Hermit's own copies.
		const hermitScript: Script = {
			entries: ['hermit', 'butler', 'imp', 'empath', 'monk'].map((id) => ({
				kind: 'official' as const,
				id
			}))
		};
		const s = scenario(['hermit', 'butler', 'imp', 'empath', 'monk'], { script: hermitScript });
		expect(owners(s, 'butler', 'Master')).toEqual([s.seat('butler'), s.seat('hermit')]);
		expect(bankItems(s.game, s.characters, options).some((i) => i.characterId === 'hermit')).toBe(
			false
		);
	});

	it("marks the only copy of a Boffin's Virgin as the Demon's", () => {
		// Wiki (https://wiki.bloodontheclocktower.com/Boffin): "The Imp has the Virgin ability."
		const s = scenario(['boffin', 'imp', 'alsaahir', 'chef', 'empath']).do((x) => ({
			type: 'SetHeldAbility',
			seatId: x.seat('imp'),
			via: 'boffin',
			characterId: 'virgin'
		}));
		expect(owners(s, 'virgin', 'No Ability')).toEqual([s.seat('imp')]);
	});

	it("leaves a character's only player's copies no one's", () => {
		const s = scenario(['monk', 'imp', 'chef', 'empath', 'poisoner']);
		expect(owners(s, 'monk', 'Safe')).toEqual([undefined]);
	});
});

describe("a player's tray, built as the bank is", () => {
	// Trevor (2026-11-06): "I want them to use the same components for parity". The player's
	// tray is `playerBankItems`: the bank's own counting stacks and generic stretch.
	const levScript: Script = {
		entries: ['leviathan', 'chef', 'empath', 'monk', 'washerwoman'].map((id) => ({
			kind: 'official' as const,
			id
		}))
	};
	const cast = [...characterLookup(data, levScript).values()].filter((c) =>
		levScript.entries.some((e) => 'id' in e && e.id === c.id)
	);
	const token = { tokenId: 't1', note: 'Chose' };

	it('lists guesses first, the rest of the script, then the generic stretch', () => {
		const items = playerBankItems(cast, ['monk'], [token]);
		expect([...new Set(items.map((i) => i.group))]).toEqual(['guesses', 'reminders', 'generic']);
		expect(items.filter((i) => i.group === 'guesses').map((i) => i.characterId)).toEqual(['monk']);
		// The ∞, the #, the phone's own ∞ token, then "+ New token", as in the bank.
		expect(items.filter((i) => i.group === 'generic').map((i) => i.key)).toEqual([
			...FIXED_GENERIC_ITEMS.map((i) => i.key),
			'token:t1',
			'new-token'
		]);
	});

	it('stacks a counting run as one token, every day of it under the first', () => {
		const items = playerBankItems(cast, [], []);
		const days = items.filter((i) => i.characterId === 'leviathan' && i.label.startsWith('Day'));
		expect(days.map((i) => i.label)).toEqual(['Day 1']);
		expect(days[0].count).toBe(5);
		expect(days[0].run).toEqual(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']);
	});

	it('narrows to a search, without the generic stretch', () => {
		const items = playerBankItems(cast, [], [token], 'washer');
		expect(new Set(items.map((i) => i.characterId))).toEqual(new Set(['washerwoman']));
	});

	it('gives a copy no label for an ∞ or # token', () => {
		expect(bankLabel({ label: 'Number' as never, number: true })).toBe('');
		expect(bankLabel({ label: 'Safe' as never })).toBe('Safe');
	});
});
