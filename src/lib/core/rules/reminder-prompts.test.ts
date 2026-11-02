import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { marksDeath, promptApplies, REMINDER_PROMPTS, reminderPrompt } from './reminder-prompts.ts';

const data = committedGameData();

describe('REMINDER_PROMPTS', () => {
	it.each(REMINDER_PROMPTS.flatMap((rule) => rule.characters.map((id) => [rule.label, id])))(
		'"%s" is a reminder of %s',
		(label, id) => {
			const character = data.byId.get(id);
			expect(character, id).toBeDefined();
			expect(character!.reminders.map((r) => r.toLowerCase())).toContain(label.toLowerCase());
		}
	);
});

describe('reminderPrompt', () => {
	it('asks to mark dead for the reminders that record a death', () => {
		// The Imp marks the player it kills as dead (https://wiki.bloodontheclocktower.com/Imp); the Undertaker's reminder
		// marks the player executed today (https://wiki.bloodontheclocktower.com/Undertaker).
		expect(reminderPrompt('Dead')).toBe('markDead');
		expect(reminderPrompt(' died today ')).toBe('markDead');
		expect(marksDeath('Died Today')).toBe(true);
	});

	it('asks to mark dead for every official character whose reminder records a death', () => {
		// The Vortox kills a player each night* (https://wiki.bloodontheclocktower.com/Vortox), as
		// do the other Demons with a "Dead" reminder; Trevor (2026-11-02, M21) found the Vortox's
		// not asking, so each one is checked by its own id, not only by its words.
		const deaths = data.characters.flatMap((c) =>
			c.reminders
				.filter((label) => /^(dead|died today)$/i.test(label))
				.map((label) => [c.id, label] as const)
		);
		expect(deaths.map(([id]) => id)).toContain('vortox');
		for (const [id, label] of deaths) expect(reminderPrompt(label, id), id).toBe('markDead');
	});

	it('asks to revive for the reminders that bring a dead player back', () => {
		// The Professor once per game may resurrect a dead player
		// (https://wiki.bloodontheclocktower.com/Professor); the Shabaloth may regurgitate a
		// player it killed, who comes back alive (https://wiki.bloodontheclocktower.com/Shabaloth).
		expect(reminderPrompt('Alive')).toBe('revive');
		expect(marksDeath('Alive')).toBe(false);
	});

	it('asks nothing for reminders about a death that has not happened', () => {
		// The Organ Grinder's and Legion's "About To Die" (https://wiki.bloodontheclocktower.com/Legion), the Tea Lady's
		// "Cannot Die" (https://wiki.bloodontheclocktower.com/Tea_Lady) and the Devil's Advocate's "Survives Execution"
		// (https://wiki.bloodontheclocktower.com/Devil%27s_Advocate) never mean the player is dead.
		for (const label of ['About To Die', 'Cannot Die', 'Survives Execution', 'Poisoned'])
			expect(reminderPrompt(label)).toBeUndefined();
	});

	it('only asks when the seat is not already in that state', () => {
		expect(promptApplies('markDead', false)).toBe(true);
		expect(promptApplies('markDead', true)).toBe(false);
		expect(promptApplies('revive', true)).toBe(true);
		expect(promptApplies('revive', false)).toBe(false);
	});
});
