/**
 * A dead player's ability kept by another character's token (`keepsAbility`), and a token that
 * impairs only while such a kept ability lasts (`impairs.tokens[].whileKept`), M15g. The
 * Vigormortis is the official character with both
 * (https://wiki.bloodontheclocktower.com/Vigormortis): a Minion it kills keeps their ability
 * only while the Vigormortis has its own, and poisons its nearest Townsfolk either way round
 * only while it still keeps that ability.
 */
import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { readImpairs } from '#lib/core/data/impairs-rules.ts';
import { abilityState } from './ability.ts';
import { deadCharacters, keepsAbilityWhenDead } from './dead-characters.ts';
import { wokeTonight } from './woke-tonight.ts';

// Seating: Ana Witch, Ben Klutz, Cat Vigormortis, Dan Sage, Eve Monk, Fay Chef. The Witch's
// nearest Townsfolk are Fay (anticlockwise, round the table) and Dan (clockwise, past the
// Outsider and the Demon).
const killed = () =>
	scenario(['witch', 'klutz', 'vigormortis', 'sage', 'monk', 'chef', 'poisoner'])
		.dies('witch', 'vigormortis')
		.reminder('witch', 'vigormortis', 'Dead')
		.reminder('witch', 'vigormortis', 'Has Ability')
		.reminder('sage', 'vigormortis', 'Poisoned');

describe('kept ability (keepsAbility)', () => {
	it('keeps a killed Minion’s ability, and their Townsfolk neighbour poisoned', () => {
		const s = killed();
		expect(abilityState(s.game, s.seat('witch'), s.characters)).toMatchObject({
			works: true,
			dead: false
		});
		expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(false);
		expect(wokeTonight(s.game, s.seat('witch'), s.characters, 'other')).toBe(true);
	});

	it('ends both when the Vigormortis dies', () => {
		const s = killed().dies('vigormortis');
		expect(keepsAbilityWhenDead(s.game, s.seat('witch'), s.characters)).toBe(false);
		expect(abilityState(s.game, s.seat('witch'), s.characters)).toMatchObject({
			works: false,
			dead: true
		});
		expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(true);
		expect(deadCharacters(s.game, s.characters).has('witch')).toBe(true);
		expect(wokeTonight(s.game, s.seat('witch'), s.characters, 'other')).toBe(false);
	});

	it('ends both while the Vigormortis is poisoned', () => {
		const s = killed().poisoned('vigormortis');
		expect(abilityState(s.game, s.seat('witch'), s.characters).works).toBe(false);
		expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(true);
		// The dead Minion still counts as having its ability for waking: a poisoned player still wakes.
		expect(keepsAbilityWhenDead(s.game, s.seat('witch'), s.characters)).toBe(true);
	});

	it('ends both once the Vigormortis becomes another Demon', () => {
		const s = killed().becomes('vigormortis', 'vortox');
		expect(keepsAbilityWhenDead(s.game, s.seat('witch'), s.characters)).toBe(false);
		expect(abilityState(s.game, s.seat('witch'), s.characters).works).toBe(false);
		expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(true);
	});

	it('cures the neighbour once the dead Minion is no longer a Minion', () => {
		const s = killed().becomes('witch', 'mayor');
		expect(abilityState(s.game, s.seat('witch'), s.characters).dead).toBe(true);
		expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(true);
	});

	it('takes the dead Minion’s ability away while they are poisoned, but not the neighbour’s poison', () => {
		const s = killed().poisoned('witch');
		expect(abilityState(s.game, s.seat('witch'), s.characters).works).toBe(false);
		expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(false);
	});

	it('poisons only a nearest Townsfolk of a Minion who keeps their ability', () => {
		// Eve is not the Witch's nearest Townsfolk either way, so a Poisoned token there does nothing.
		const s = killed().reminder('monk', 'vigormortis', 'Poisoned');
		expect(abilityState(s.game, s.seat('monk'), s.characters).works).toBe(true);
		// Fay is, round the table the other way.
		const t = killed().reminder('chef', 'vigormortis', 'Poisoned');
		expect(abilityState(t.game, t.seat('chef'), t.characters).works).toBe(false);
	});

	it('poisons nobody when no Minion keeps their ability', () => {
		const s = scenario([
			'witch',
			'klutz',
			'vigormortis',
			'sage',
			'monk',
			'chef',
			'poisoner'
		]).reminder('sage', 'vigormortis', 'Poisoned');
		expect(abilityState(s.game, s.seat('sage'), s.characters).works).toBe(true);
	});
});

describe('readImpairs whileKept', () => {
	const reminders = ['Has Ability', 'Poisoned'];
	it('reads a token and an optional nearest type', () => {
		const issues = new Issues();
		const out = readImpairs(
			{
				tokens: {
					Poisoned: {
						reason: 'poisoned',
						on: 'carrier',
						whileKept: { token: 'Has Ability', nearest: 'townsfolk' }
					}
				}
			},
			'impairs',
			issues,
			reminders
		);
		expect(issues.list).toEqual([]);
		expect(out?.tokens?.Poisoned?.whileKept).toEqual({
			token: 'Has Ability',
			nearest: 'townsfolk'
		});
	});

	it('rejects a token the character does not have', () => {
		const issues = new Issues();
		readImpairs(
			{ tokens: { Poisoned: { reason: 'poisoned', on: 'carrier', whileKept: { token: 'Safe' } } } },
			'impairs',
			issues,
			reminders
		);
		expect(issues.list).toEqual([
			expect.stringMatching(/^impairs.tokens.Poisoned.whileKept.token: /)
		]);
	});
});
