import { describe, expect, it } from 'vitest';
import { marksDeath } from './death-reminders.ts';

describe('marksDeath', () => {
	it('is true for the reminders that record a death', () => {
		// The Imp marks the player it kills as dead (https://wiki.bloodontheclocktower.com/Imp); the Undertaker's reminder
		// marks the player executed today (https://wiki.bloodontheclocktower.com/Undertaker).
		expect(marksDeath('Dead')).toBe(true);
		expect(marksDeath('Died Today')).toBe(true);
		expect(marksDeath(' died today ')).toBe(true);
	});

	it('is false for reminders about a death that has not happened', () => {
		// The Organ Grinder's and Legion's "About To Die" (https://wiki.bloodontheclocktower.com/Legion), the Tea Lady's
		// "Cannot Die" (https://wiki.bloodontheclocktower.com/Tea_Lady) and the Devil's Advocate's "Survives Execution"
		// (https://wiki.bloodontheclocktower.com/Devil%27s_Advocate) never mean the player is dead.
		for (const label of ['About To Die', 'Cannot Die', 'Survives Execution', 'Poisoned'])
			expect(marksDeath(label)).toBe(false);
	});
});
