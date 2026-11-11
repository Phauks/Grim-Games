/**
 * Wake steps for changed characters: the new Imp is woken and shown "You are" and the Imp
 * token (https://wiki.bloodontheclocktower.com/Imp); a player the Pit-Hag changes learns
 * their new character (https://wiki.bloodontheclocktower.com/Pit-Hag).
 */
import { describe, expect, it } from 'vitest';
import { testCharacters as characters } from '#lib/core/model/fixtures.test-support.ts';
import { withCharacterChangeSteps } from './character-changes.ts';
import type { NightStep } from './night-order.ts';
import { nightTextPlain, nightTextSegments } from './night-text.ts';

const marker = (id: string, afterDawn = false): NightStep => ({
	id,
	kind: 'marker',
	afterDawn,
	placement: 'marker',
	notes: []
});

describe('withCharacterChangeSteps', () => {
	it('adds a wake step before Dawn for each changed seat, in the order given', () => {
		const steps = [marker('dusk'), marker('dawn'), marker('leviathan', true)];
		const out = withCharacterChangeSteps(
			steps,
			[
				{ seatId: 's1', characterId: 'imp' },
				{ seatId: 's4', characterId: 'fanggu' }
			],
			characters
		);
		expect(out.map((s) => s.id)).toEqual(['dusk', 'changed@s1', 'changed@s4', 'dawn', 'leviathan']);
		expect(out[1]).toMatchObject({
			kind: 'custom',
			character: { id: 'imp' },
			changed: { seatId: 's1', characterId: 'imp' }
		});
	});

	it('shows the "You are" info token, then the new character', () => {
		const [step] = withCharacterChangeSteps([], [{ seatId: 's1', characterId: 'imp' }], characters);
		expect(
			nightTextPlain(nightTextSegments(step.reminder ?? '', { reminders: [], remindersGlobal: [] }))
		).toBe('Wake this player. Show the «You are» info token, then the Imp token.');
	});

	it('changes nothing without changes, and skips unknown characters', () => {
		const steps = [marker('dusk'), marker('dawn')];
		expect(withCharacterChangeSteps(steps, [], characters)).toEqual(steps);
		expect(
			withCharacterChangeSteps(steps, [{ seatId: 's1', characterId: 'nobody' }], characters)
		).toEqual(steps);
	});
});
