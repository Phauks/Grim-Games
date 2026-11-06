import { describe, expect, it } from 'vitest';
import {
	MAX_SEAT_REMINDERS,
	addGenericReminder,
	countUp,
	hasReminder,
	moveReminder,
	parsePlayerReminders,
	reminderWords,
	parsePlayerTokens,
	phaseCount,
	setGenericLook,
	toggleReminder
} from './player-reminders.ts';

const poisoned = { characterId: 'poisoner', label: 'Poisoned' };
const dead = { characterId: 'imp', label: 'Dead' };

describe("reminder tokens on a player's own grim", () => {
	it('puts a reminder on a seat, and a second tap takes it off', () => {
		let reminders = toggleReminder({}, 's1', poisoned);
		reminders = toggleReminder(reminders, 's1', dead);
		expect(reminders).toEqual({ s1: [poisoned, dead] });
		expect(hasReminder(reminders, 's1', dead)).toBe(true);
		expect(toggleReminder(reminders, 's1', poisoned)).toEqual({ s1: [dead] });
		expect(toggleReminder(toggleReminder(reminders, 's1', poisoned), 's1', dead)).toEqual({});
	});

	it('lets the same reminder sit on several seats', () => {
		const reminders = toggleReminder(toggleReminder({}, 's1', poisoned), 's2', poisoned);
		expect(reminders).toEqual({ s1: [poisoned], s2: [poisoned] });
	});

	it('keeps a seat to its most reminders', () => {
		let reminders = {};
		for (let i = 0; i < MAX_SEAT_REMINDERS + 2; i++)
			reminders = toggleReminder(reminders, 's1', { characterId: 'x', label: `R${i}` });
		expect(parsePlayerReminders(reminders).s1).toHaveLength(MAX_SEAT_REMINDERS);
	});

	it('reads anything damaged as no reminders', () => {
		expect(parsePlayerReminders('x')).toEqual({});
		expect(parsePlayerReminders([poisoned])).toEqual({});
		expect(
			parsePlayerReminders({ s1: 'Poisoned', s2: [3, { label: 'Dead' }, dead, dead], s3: [] })
		).toEqual({ s2: [dead] });
	});

	it('moves a picked-up token to another seat, keeping its look, or back off its seat', () => {
		// Trevor (2026-10-31): a token on the player's grim is picked up as on the board.
		let reminders = setGenericLook(addGenericReminder({}, 's1', 'g1'), 's1', 'g1', { note: '3' });
		reminders = toggleReminder(reminders, 's1', poisoned);
		const generic = reminders.s1[0];
		const moved = moveReminder(reminders, 's1', generic, 's2');
		expect(moved.s1).toEqual([poisoned]);
		expect(moved.s2).toEqual([generic]);
		expect(moved.s2[0]).toMatchObject({ id: 'g1', note: '3' });
		// Onto a seat that already has it: one copy there, gone from where it was.
		const both = toggleReminder(moved, 's3', poisoned);
		expect(moveReminder(both, 's1', poisoned, 's3')).toEqual({ s2: [generic], s3: [poisoned] });
		// Back to the tray.
		expect(moveReminder(moved, 's2', generic)).toEqual({ s1: [poisoned] });
	});

	it('holds several generic tokens on a seat, each with its own text and symbol', () => {
		let reminders = addGenericReminder({}, 's1', 'g1');
		reminders = addGenericReminder(reminders, 's1', 'g2');
		reminders = setGenericLook(reminders, 's1', 'g1', { note: '2', symbolColour: 'gold' });
		const [one, two] = reminders.s1;
		expect(one).toMatchObject({ id: 'g1', note: '2', symbolColour: 'gold' });
		expect(reminderWords(one)).toBe('2');
		expect(reminderWords(two)).toBe('∞');
		// Emptied, the text goes; a second tap on the same id takes it off.
		reminders = setGenericLook(reminders, 's1', 'g1', { note: undefined });
		expect(reminders.s1[0]).not.toHaveProperty('note');
		expect(toggleReminder(reminders, 's1', two).s1).toHaveLength(1);
	});

	it("keeps a # token's number and names it as the board does", () => {
		// Trevor (2026-11-06): the player's tray has the bank's # token (plan M35) too.
		let reminders = addGenericReminder({}, 's1', 'n1');
		reminders = setGenericLook(reminders, 's1', 'n1', { symbol: '#3' });
		expect(reminders.s1[0]).toMatchObject({ id: 'n1', symbol: '#3' });
		expect(reminderWords(reminders.s1[0])).toBe('3');
		reminders = setGenericLook(reminders, 's1', 'n1', { note: 'Votes' });
		expect(reminderWords(reminders.s1[0])).toBe('3: Votes');
	});

	it('drops a generic token with no id or a look it does not know', () => {
		expect(
			parsePlayerReminders({
				s1: [
					{ characterId: 'generic', label: '' },
					{ characterId: 'generic', label: 'x', id: 'g', symbolColour: 'pink', symbolFill: 1 }
				]
			})
		).toEqual({ s1: [{ characterId: 'generic', label: '', id: 'g' }] });
	});

	it("keeps a copied reminder's art and a # token that counts up", () => {
		const kept = parsePlayerReminders({
			s1: [
				{
					characterId: 'generic',
					label: '',
					id: 'g',
					note: 'Poisoned',
					like: { characterId: 'poisoner', label: 'Poisoned' },
					countsUp: 'dusk'
				},
				{ characterId: 'generic', label: '', id: 'h', countsUp: 'sometimes' }
			]
		});
		expect(kept.s1[0]).toMatchObject({ like: poisoned, countsUp: 'dusk' });
		expect(kept.s1[1]).not.toHaveProperty('countsUp');
	});

	it('counts # tokens up once for each dusk or dawn passed, to the highest number', () => {
		// The board's Counts up (plan M53): Each night at dusk, Each day at dawn.
		const reminders = parsePlayerReminders({
			s1: [
				{ characterId: 'generic', label: '', id: 'n', symbol: '#2', countsUp: 'dusk' },
				{ characterId: 'generic', label: '', id: 'd', symbol: '#19', countsUp: 'dawn' },
				{ characterId: 'generic', label: '', id: 'x', symbol: '#5' }
			]
		});
		expect(phaseCount({ kind: 'night', number: 2 })).toEqual({ dusk: 2, dawn: 1 });
		expect(phaseCount({ kind: 'day', number: 2 })).toEqual({ dusk: 2, dawn: 2 });
		expect(phaseCount({ kind: 'setup' })).toEqual({ dusk: 0, dawn: 0 });
		const up = countUp(reminders, { dusk: 1, dawn: 3 }).s1.map((r) => r.symbol);
		expect(up).toEqual(['#3', '#20', '#5']);
	});

	it("reads a player's own ∞ tokens, dropping damaged ones", () => {
		expect(
			parsePlayerTokens([
				{ tokenId: 't1', note: 'Chose', symbol: '#1' },
				{ tokenId: 't1', note: 'twice' },
				{ note: 'no id' },
				'junk'
			])
		).toEqual([{ tokenId: 't1', note: 'Chose', symbol: '#1' }]);
		expect(parsePlayerTokens({})).toEqual([]);
	});
});
