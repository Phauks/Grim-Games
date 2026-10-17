import { describe, expect, it } from 'vitest';
import { editionScript, toScript } from '#lib/core/data/index.ts';
import { characterLookup, type Game, type Seat } from '#lib/core/model/index.ts';
import { createGame, dispatch } from '#lib/core/engine/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	causeLabel,
	isOrphan,
	placingAlignment,
	recommendedTravellers,
	reminderFitWarning,
	seatMisses,
	pickerGroups,
	tableCheck
} from './board.ts';

const data = committedGameData();
const tb = toScript(editionScript('tb', data)!);
const characters = characterLookup(data, tb);

function seat(characterId?: string): Seat {
	return {
		seatId: 's',
		characterId,
		dead: false,
		ghostVoteUsed: false,
		overrides: [],
		reminders: []
	};
}

describe('pickerGroups', () => {
	it('offers the script by type, plus every Traveller', () => {
		const groups = pickerGroups(characters, tb, ['townsfolk', 'demon', 'traveller'], false);
		expect(groups.map((g) => g.type)).toEqual(['townsfolk', 'demon', 'traveller']);
		expect(groups[0].characters.map((c) => c.id)).toEqual(
			tb.entries.flatMap((e) =>
				e.kind === 'official' && characters.get(e.id)?.type === 'townsfolk' ? [e.id] : []
			)
		);
		expect(groups[1].characters.map((c) => c.id)).toEqual(['imp']);
		expect(groups[2].characters.some((c) => c.id === 'gunslinger')).toBe(true);
		expect(groups[2].characters.some((c) => c.edition === 'bmr')).toBe(true);
	});
	it('adds characters off the script when asked, after the script ones', () => {
		const demons = pickerGroups(characters, tb, ['demon'], true)[0].characters;
		expect(demons[0].id).toBe('imp');
		expect(demons.some((c) => c.id === 'zombuul')).toBe(true);
	});
});

describe('isOrphan', () => {
	it('flags a character that is not on the script, never a Traveller', () => {
		expect(isOrphan(seat('imp'), tb, characters)).toBe(false);
		expect(isOrphan(seat('zombuul'), tb, characters)).toBe(true);
		expect(isOrphan(seat('gunslinger'), tb, characters)).toBe(false);
		expect(isOrphan(seat(), tb, characters)).toBe(false);
	});
});

describe('causeLabel', () => {
	// https://wiki.bloodontheclocktower.com/Travellers and /Exile: Travellers are exiled, not executed.
	it('says Exiled for a Traveller', () => {
		expect(causeLabel('execution', characters)).toBe('Executed');
		expect(causeLabel('execution', characters, true)).toBe('Exiled');
		expect(causeLabel('exile', characters)).toBe('Exiled');
	});
});

describe('recommendedTravellers', () => {
	// https://wiki.bloodontheclocktower.com/Trouble_Brewing : its Travellers are the Scapegoat,
	// Gunslinger, Beggar, Bureaucrat and Thief.
	it("recommends an official edition's own Travellers", () => {
		expect(new Set(recommendedTravellers(tb, characters))).toEqual(
			new Set(['scapegoat', 'gunslinger', 'beggar', 'bureaucrat', 'thief'])
		);
	});
});

describe('placingAlignment', () => {
	it("is the alignment of the seat holding the reminder's character", () => {
		const evilEmpath: Seat = { ...seat('empath'), seatId: 'a', alignment: 'evil' };
		const game = { seating: ['a'], seats: { a: evilEmpath } } as unknown as Game;
		expect(placingAlignment(game, 'empath', characters)).toBe('evil');
		expect(placingAlignment(game, 'poisoner', characters)).toBeUndefined();
	});
});

describe('tableCheck', () => {
	// https://wiki.bloodontheclocktower.com/Setup : 5 players are 3 Townsfolk, 0 Outsiders,
	// 1 Minion, 1 Demon; 6 players add an Outsider. The Baron adds two Outsiders.
	function table(ids: (string | undefined)[]): Game {
		const seats = ids.map((characterId, i) => ({ ...seat(characterId), seatId: `s${i}` }));
		return {
			seating: seats.map((s) => s.seatId),
			seats: Object.fromEntries(seats.map((s) => [s.seatId, s])),
			ruleCharacters: []
		} as unknown as Game;
	}
	const five = ['washerwoman', 'chef', 'empath', 'poisoner', 'imp'];

	it('says the player count and that a full, matching table stays valid', () => {
		const g = table([...five, 'butler']);
		const check = tableCheck(g, characters, { kind: 'remove-seat', seatId: 's5' });
		expect(check.players).toEqual({ before: 6, after: 5 });
		expect(check.problems).toEqual([]);
		expect(check.wasOff).toBe(false);
	});
	it('names what no longer matches', () => {
		const check = tableCheck(table(five), characters, { kind: 'remove-seat', seatId: 's3' });
		expect(check.players).toEqual({ before: 5, after: 4 });
		expect(check.problems.length).toBeGreaterThan(0);
		expect(check.wasOff).toBe(false);
	});
	it('does not count Travellers as players', () => {
		const check = tableCheck(table([...five, 'thief']), characters, {
			kind: 'remove-seat',
			seatId: 's5'
		});
		expect(check.players).toEqual({ before: 5, after: 5 });
		expect(check.problems).toEqual([]);
	});
	it('keeps the count when only the character goes', () => {
		const check = tableCheck(table(five), characters, { kind: 'remove-character', seatId: 's0' });
		expect(check.players).toEqual({ before: 5, after: 5 });
		expect(check.problems.length).toBeGreaterThan(0);
	});
});

describe('reminderFitWarning', () => {
	// https://wiki.bloodontheclocktower.com/Washerwoman : the "Townsfolk" token marks a
	// Townsfolk; on the Poisoner it is placed anyway, with a warning.
	it('warns when a reminder goes on a seat it does not fit, and is quiet when it fits', () => {
		let n = 0;
		const ctx = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };
		let session = createGame({ type: 'CreateGame', script: tb, playerCount: 5 }, ctx);
		if (!session.ok) throw new Error();
		const [a, b] = session.session.game.seating;
		for (const [seatId, characterId] of [
			[a, 'poisoner'],
			[b, 'chef']
		] as const) {
			session = dispatch(session.session, { type: 'AssignCharacter', seatId, characterId }, ctx);
			if (!session.ok) throw new Error();
		}
		const g = session.session.game;
		const townsfolk = { characterId: 'washerwoman', label: 'Townsfolk' };
		expect(reminderFitWarning(g, townsfolk, a, characters)).toMatch(/character type/);
		expect(reminderFitWarning(g, townsfolk, b, characters)).toBeUndefined();
	});
});

describe('seatMisses', () => {
	it('does not judge a seat with no character on its character type', () => {
		let n = 0;
		const ctx = { characters, newId: () => `id${++n}`, now: () => 0, random: () => 0 };
		const created = createGame({ type: 'CreateGame', script: tb, playerCount: 5 }, ctx);
		if (!created.ok) throw new Error();
		const g = created.session.game;
		const townsfolk = { characterId: 'washerwoman', label: 'Townsfolk' };
		expect(seatMisses(g, townsfolk, g.seating[0], characters)).toEqual([]);
	});
});
