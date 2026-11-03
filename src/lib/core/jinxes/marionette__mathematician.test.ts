/**
 * Jinx Marionette + Mathematician: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Marionette
 * Wiki: https://wiki.bloodontheclocktower.com/Mathematician
 * (the wiki has no jinx page; each character's page lists the jinx under "Related Jinxes")
 */
import { describe, expect, it } from 'vitest';
import { findJinx, jinxesAmong } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { ownAbilityTests } from './mathematician.test-support.ts';

describe('Marionette + Mathematician jinx', () => {
	const data = committedGameData();
	const jinx = findJinx(data.jinxes, 'marionette', 'mathematician');

	it('is in jinxes.json between two official characters', () => {
		expect(data.byId.get('marionette')?.name).toBe('Marionette');
		expect(data.byId.get('mathematician')?.name).toBe('Mathematician');
		expect(jinx).toBeDefined();
		expect(jinx?.reason).not.toBe('');
	});

	it('applies only when both characters are on the script', () => {
		expect(jinxesAmong(data.jinxes, ['marionette', 'mathematician'])).toContain(jinx);
		expect(jinxesAmong(data.jinxes, ['marionette'])).not.toContain(jinx);
		expect(jinxesAmong(data.jinxes, ['mathematician'])).not.toContain(jinx);
	});

	// Wiki: "The Mathematician learns if the Marionette’s ability yielded false info or failed to work properly."
	ownAbilityTests('marionette', (s) => s.reminder('chef', 'marionette', 'Is The Marionette'));
});
