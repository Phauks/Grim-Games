import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/index.ts';
import {
	MAX_SEAT_REMINDERS,
	hasReminder,
	parsePlayerReminders,
	scriptReminderGroups,
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

	it("offers every reminder of the script's characters, in script order", () => {
		const character = (id: string, reminders: string[], remindersGlobal: string[] = []) =>
			({ id, name: id, type: 'townsfolk', reminders, remindersGlobal }) as unknown as Character;
		const groups = scriptReminderGroups([
			character('washerwoman', ['Wrong', 'Townsfolk']),
			character('chef', []),
			character('drunk', [], ['Drunk'])
		]);
		expect(groups.map((g) => [g.character.id, g.labels])).toEqual([
			['washerwoman', ['Townsfolk', 'Wrong']],
			['drunk', ['Drunk']]
		]);
	});
});
