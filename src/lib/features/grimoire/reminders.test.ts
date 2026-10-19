import { describe, expect, it } from 'vitest';
import { editionScript, loadScript, toScript } from '#lib/core/data/index.ts';
import { createGame, dispatch, type EngineContext } from '#lib/core/engine/index.ts';
import { characterLookup } from '#lib/core/model/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	bankOwners,
	bankReminders,
	byLabel,
	canAddCopy,
	extraReminders,
	reminderCopies,
	stepReminders,
	parseReminderKey,
	reminderCopiesLeft,
	reminderGroups,
	reminderKey,
	isGeneric,
	tokenLabel
} from './reminders.ts';
import { placingAlignment } from './board.ts';
import { GENERIC_REMINDER_ID } from '#lib/core/model/index.ts';

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
	it('offers characters in play, and only global reminders of those never in the bag', () => {
		const groups = reminderGroups(game(), characters);
		const ids = groups.map((g) => g.character.id);
		// Trouble Brewing lists the Drunk (an Outsider) before the Poisoner (a Minion).
		expect(ids.indexOf('drunk')).toBeLessThan(ids.indexOf('poisoner'));
		expect(groups.find((g) => g.character.id === 'poisoner')?.labels).toEqual(['Poisoned']);
		// Tokens given out by hand: any player may secretly be the Drunk.
		expect(groups.find((g) => g.character.id === 'drunk')?.labels).toEqual(['Is The Drunk']);
		expect(groups.some((g) => g.character.id === 'washerwoman')).toBe(false);
	});
	// https://wiki.bloodontheclocktower.com/Drunk : the Drunk's player is shown a Townsfolk, so
	// the Drunk is in play only when the Storyteller chose it (Trevor, 2026-10-18: "Is The
	// Drunk" was offered before the bag was set up).
	it('offers no Drunk on an empty board, or when the bag has none', () => {
		const created = createGame({ type: 'CreateGame', script, playerCount: 5 }, ctx);
		if (!created.ok) throw new Error();
		const empty = created.session.game;
		const has = (g: typeof empty) =>
			reminderGroups(g, characters).some((x) => x.character.id === 'drunk');
		expect(has(empty)).toBe(false);
		const bag = { tiles: {}, order: [], includeTravellers: false };
		expect(has({ ...game(), bag })).toBe(false);
		const drunk = { characterId: 'drunk', label: 'Is The Drunk' } as const;
		expect(has({ ...empty, bag: { ...bag, unseated: [drunk] } })).toBe(true);
	});
	// Trevor (2026-10-16): Catfishing offered "Is The Philosopher" with no Philosopher in play.
	// https://wiki.bloodontheclocktower.com/Philosopher : the reminder marks a Philosopher who
	// has gained an ability, so it only matters once one is in play.
	it('offers no "Is The Philosopher" for a Philosopher only on the script', () => {
		const loaded = loadScript(
			[{ id: '_meta', name: 'Catfishing' }, 'philosopher', 'lilmonsta', 'chef', 'imp'],
			data
		).script!;
		const cat = toScript(loaded);
		const created = createGame(
			{ type: 'CreateGame', script: cat, playerCount: 5 },
			{ ...ctx, characters: characterLookup(data, cat) }
		);
		if (!created.ok) throw new Error();
		const groups = reminderGroups(created.session.game, characterLookup(data, cat));
		expect(groups.some((g) => g.character.id === 'philosopher')).toBe(false);
		// https://wiki.bloodontheclocktower.com/Lil%27_Monsta : never in the bag and no player is
		// dealt it, so its "Is The Demon" babysitter reminder stays on offer.
		expect(groups.find((g) => g.character.id === 'lilmonsta')?.labels).toContain('Is The Demon');
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
	it('counts an extra copy while it is on the board, and never goes below none left', () => {
		let g = game();
		const key = reminderKey({ characterId: 'poisoner', label: 'Poisoned' });
		for (const seatId of [g.seating[2], g.seating[3]]) {
			const result = dispatch(
				{ log: { entries: [], cursor: 0 }, game: g },
				{ type: 'AddReminder', seatId, reminder: { characterId: 'poisoner', label: 'Poisoned' } },
				ctx
			);
			if (!result.ok) throw new Error(result.error.message);
			g = result.session.game;
		}
		expect(reminderCopies(g, characters).get(key)).toBe(2);
		expect(reminderCopiesLeft(g, characters).get(key)).toBe(0);
	});
	// Trevor (2026-10-18): Duplicate reminder makes a new token; it never takes the bank's.
	it("leaves the bank's copies alone for a duplicate, which is always extra", () => {
		let g = game();
		const key = reminderKey({ characterId: 'poisoner', label: 'Poisoned' });
		const run = (command: Parameters<typeof dispatch>[1]) => {
			const result = dispatch({ log: { entries: [], cursor: 0 }, game: g }, command, ctx);
			if (!result.ok) throw new Error(result.error.message);
			g = result.session.game;
		};
		// A second Poisoner: the game gives two Poisoned tokens.
		run({ type: 'AssignCharacter', seatId: g.seating[3], characterId: 'poisoner' });
		const poisoned = { characterId: 'poisoner', label: 'Poisoned' };
		run({ type: 'AddReminder', seatId: g.seating[2], reminder: poisoned });
		run({ type: 'AddReminder', seatId: g.seating[2], reminder: poisoned });
		const copy = g.seats[g.seating[2]].reminders.at(-1)!.reminderId;
		const copies = new Set([copy]);
		expect(reminderCopiesLeft(g, characters).get(key)).toBe(0);
		expect(reminderCopiesLeft(g, characters, copies).get(key)).toBe(1);
		expect(bankReminders(g, characters, undefined, true, copies)).toContainEqual(
			expect.objectContaining({ ...poisoned, left: 1 })
		);
		expect(extraReminders(g, characters, copies)).toEqual(copies);
	});
});

describe('canAddCopy', () => {
	it("offers extra copies for a script's own characters only", () => {
		expect(canAddCopy(characters.get('poisoner'))).toBe(false);
		expect(canAddCopy({ ...characters.get('poisoner')!, edition: undefined })).toBe(true);
		expect(canAddCopy(undefined)).toBe(false);
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
	it("can mark the step's reminders in their usual place instead (Trevor, 2026-10-17)", () => {
		let g = game();
		g = run(g, { type: 'AssignCharacter', seatId: g.seating[1], characterId: 'monk' });
		g = run(g, { type: 'AssignCharacter', seatId: g.seating[2], characterId: 'poisoner' });
		const focus = stepReminders('poisoner', 'other');
		expect(bankReminders(g, characters, focus)[0].characterId).toBe('poisoner');
		const kept = bankReminders(g, characters, focus, false);
		expect(kept[0]).toMatchObject({ characterId: 'monk', now: false });
		expect(kept.find((r) => r.characterId === 'poisoner')?.now).toBe(true);
	});
	// https://wiki.bloodontheclocktower.com/Grandmother : her grandchild's death kills her,
	// which can only happen after the first night.
	it("marks every reminder of a script's own character, which has no night data", () => {
		const merchant = {
			...characters.get('poisoner')!,
			id: 'merchant',
			edition: undefined,
			reminders: ['Chosen', 'Paid'],
			remindersGlobal: []
		};
		expect(stepReminders('merchant', 'other', merchant).labels).toEqual(['Chosen', 'Paid']);
		// An official character keeps its night data even when given.
		expect(stepReminders('monk', 'first', characters.get('monk')).labels).toEqual([]);
	});
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

describe('extraReminders', () => {
	// Trevor (2026-10-18): a duplicated reminder beyond the copies the game gives is marked.
	it('marks the copies placed after the ones the game gives', () => {
		let g = game();
		const ids: string[] = [];
		for (const seatId of [g.seating[2], g.seating[3]]) {
			const result = dispatch(
				{ log: { entries: [], cursor: 0 }, game: g },
				{ type: 'AddReminder', seatId, reminder: { characterId: 'poisoner', label: 'Poisoned' } },
				ctx
			);
			if (!result.ok) throw new Error(result.error.message);
			g = result.session.game;
			ids.push(g.seats[seatId].reminders.at(-1)!.reminderId);
		}
		expect([...extraReminders(g, characters)]).toEqual([ids[1]]);
	});
});

describe('the generic reminder', () => {
	// Trevor (2026-10-18): a plain ∞ reminder, as many as needed, with optional text.
	it('is never counted or marked as an extra copy, and shows its text or ∞', () => {
		let g = game();
		for (const seatId of g.seating.slice(0, 3)) {
			const result = dispatch(
				{ log: { entries: [], cursor: 0 }, game: g },
				{ type: 'AddReminder', seatId, reminder: { characterId: GENERIC_REMINDER_ID, label: '' } },
				ctx
			);
			if (!result.ok) throw new Error(result.error.message);
			g = result.session.game;
		}
		expect(extraReminders(g, characters).size).toBe(0);
		expect(
			reminderCopiesLeft(g, characters).has(
				reminderKey({ characterId: GENERIC_REMINDER_ID, label: '' })
			)
		).toBe(false);
		const [placed] = g.seats[g.seating[0]].reminders;
		expect(isGeneric(placed)).toBe(true);
		expect(tokenLabel(placed)).toBe('∞');
		expect(tokenLabel({ ...placed, note: 'Chose Sam' })).toBe('Chose Sam');
		expect(tokenLabel({ characterId: 'poisoner', label: 'Poisoned' } as never)).toBe('Poisoned');
	});
});

describe('bankOwners', () => {
	// Trevor (2026-10-19): two Imps, one good and one evil, each have their own "Dead" token,
	// in their own colour (https://wiki.bloodontheclocktower.com/Imp lists one "Dead" token).
	it("gives each seat holding the character its own copies, in that seat's colour", () => {
		let g = game();
		const run = (command: Parameters<typeof dispatch>[1]) => {
			const result = dispatch({ log: { entries: [], cursor: 0 }, game: g }, command, ctx);
			if (!result.ok) throw new Error(result.error.message);
			g = result.session.game;
		};
		const [, evil, , good] = g.seating;
		run({ type: 'AssignCharacter', seatId: evil, characterId: 'imp' });
		run({ type: 'AssignCharacter', seatId: good, characterId: 'imp' });
		run({ type: 'SetAlignment', seatId: good, alignment: 'good' });
		const dead = { characterId: 'imp', label: 'Dead' } as const;
		const left = () => reminderCopiesLeft(g, characters).get(reminderKey(dead)) ?? 0;
		expect(bankOwners(g, characters, dead, left())).toEqual([
			{ ownerSeatId: evil, count: 1 },
			{ ownerSeatId: good, count: 1 }
		]);
		expect(placingAlignment(g, { ...dead, ownerSeatId: good }, characters)).toBe('good');
		expect(placingAlignment(g, { ...dead, ownerSeatId: evil }, characters)).toBe('evil');

		// The good Imp's token is placed: only the evil Imp's is left, and the placed one keeps
		// its owner.
		run({ type: 'AddReminder', seatId: g.seating[4], reminder: { ...dead, ownerSeatId: good } });
		expect(g.seats[g.seating[4]].reminders[0].ownerSeatId).toBe(good);
		expect(bankOwners(g, characters, dead, left())).toEqual([{ ownerSeatId: evil, count: 1 }]);
	});
	it('belongs to no one with the character on one seat, and drops an unknown owner', () => {
		let g = game();
		const poisoned = { characterId: 'poisoner', label: 'Poisoned' } as const;
		expect(bankOwners(g, characters, poisoned, 1)).toEqual([{ count: 1 }]);
		const result = dispatch(
			{ log: { entries: [], cursor: 0 }, game: g },
			{
				type: 'AddReminder',
				seatId: g.seating[2],
				reminder: { ...poisoned, ownerSeatId: 'no-such-seat' }
			},
			ctx
		);
		if (!result.ok) throw new Error(result.error.message);
		g = result.session.game;
		expect(g.seats[g.seating[2]].reminders[0]).not.toHaveProperty('ownerSeatId');
	});
});
