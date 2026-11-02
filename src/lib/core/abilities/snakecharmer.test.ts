/**
 * Snake Charmer: rules tests.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Snake_Charmer
 *
 * Data checks: generated from static/data/roles.json by `npm run scaffold:rules-tests`. They
 * pin TPI's current data, so review and update them when a data sync changes Snake Charmer.
 *
 * Wiki examples: each `it.todo` is one example in the page's Examples section. Replace it with
 * a test written with `scenario` (src/lib/core/testing/scenario.ts): the seats, what has
 * happened, then what the rules say. Paraphrase the example; never copy wiki prose.
 */
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from '#lib/core/data/index.ts';
import { committedCharacter, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { abilityState } from '#lib/core/rules/ability.ts';
import { becomesOffer } from '#lib/core/rules/becomes.ts';
import { reminderTargetMisses } from '#lib/core/rules/reminder-targets.ts';
import { scenario, type Scenario, type SeatRef } from '#lib/core/testing/scenario.ts';

const charmed = { characterId: 'snakecharmer', label: 'Poisoned' } as const;

/**
 * The Snake Charmer's night as the board runs it: the Poisoned token goes on the player it
 * chose, and when that player is the Demon the board offers the swap, which is taken.
 */
function charms(s: Scenario, chosen: SeatRef): Scenario {
	const placed = s.reminder(chosen, 'snakecharmer', 'Poisoned');
	const offer = becomesOffer(placed.game, placed.seat(chosen), charmed, placed.characters);
	if (offer?.into !== 'swap') return placed;
	return placed.do({ type: 'SwapCharacters', seatId: offer.seatId, withSeatId: offer.withSeatId });
}

const poisonedBy = (s: Scenario, seat: SeatRef) =>
	abilityState(s.game, s.seat(seat), s.characters).impairments.some(
		(i) => i.reason === 'poisoned' && i.source.characterId === 'snakecharmer'
	);

describe('Snake Charmer', () => {
	const character = committedCharacter('snakecharmer');

	describe('data (roles.json)', () => {
		it('is a Townsfolk from edition snv', () => {
			expect(character.name).toBe('Snake Charmer');
			expect(character.type).toBe('townsfolk');
			expect(character.edition).toBe('snv');
			expect(defaultAlignment(character.type)).toBe('good');
		});

		it('does not change setup', () => {
			expect(character.setup).toBe(false);
		});

		it('has its reminder tokens', () => {
			expect(character.reminders).toEqual(['Poisoned']);
			expect(character.remindersGlobal).toEqual([]);
		});

		it('is on the night sheet for the first night and other nights', () => {
			expect(nightSheetPresence('snakecharmer')).toEqual({ firstNight: true, otherNight: true });
		});

		it('has no special app hooks', () => {
			expect(character.special).toEqual([]);
		});
	});

	describe('the Poisoned token (https://wiki.bloodontheclocktower.com/Snake_Charmer#How_to_Run)', () => {
		it('fits only the living Demon, the player it goes on before the swap', () => {
			// The token marks the Demon the Snake Charmer chose; the swap then leaves it on
			// the old Demon, now the Snake Charmer. Before the swap, the Snake Charmer's own
			// seat is not where it goes.
			const s = scenario(['snakecharmer', 'chef', 'imp']);
			const misses = (seat: SeatRef) =>
				reminderTargetMisses(s.game, charmed, s.seat(seat), s.characters);
			expect(misses('imp')).toEqual([]);
			expect(misses('snakecharmer')).not.toEqual([]);
			expect(misses('chef')).not.toEqual([]);
			const dead = s.dies('imp');
			expect(reminderTargetMisses(dead.game, charmed, dead.seat('imp'), dead.characters)).toContain(
				'life'
			);
		});

		it('ends on the old Demon, who is the poisoned good Snake Charmer', () => {
			const s = charms(scenario(['snakecharmer', 'chef', 'imp']), 'imp');
			const was = s.game.seats[s.seat('imp')];
			expect(was).toMatchObject({ characterId: 'snakecharmer', alignment: 'good' });
			expect(was.reminders.map((r) => r.label)).toEqual(['Poisoned']);
			expect(poisonedBy(s, 'imp')).toBe(true);
			expect(s.game.seats[s.seat('snakecharmer')]).toMatchObject({
				characterId: 'imp',
				alignment: 'evil'
			});
			expect(s.game.seats[s.seat('snakecharmer')].reminders).toEqual([]);
			expect(poisonedBy(s, 'snakecharmer')).toBe(false);
		});

		it('keeps poisoning for good: the ability says the old Demon is then poisoned', () => {
			const s = charms(scenario(['snakecharmer', 'chef', 'imp']), 'imp').dies('snakecharmer');
			expect(poisonedBy(s, 'imp')).toBe(true);
		});
	});

	describe('wiki examples (https://wiki.bloodontheclocktower.com/Snake_Charmer#Examples)', () => {
		it('Example 1: Snake Charmer picks Pit-Hag, nothing changes', () => {
			// Choosing a Minion, then themself, swaps nothing and poisons no one.
			const start = scenario(['snakecharmer', 'pithag', 'vigormortis', 'chef']);
			const s = charms(start, 'pithag');
			expect(becomesOffer(s.game, s.seat('pithag'), charmed, s.characters)).toBeUndefined();
			expect(s.game.seats[s.seat('pithag')].characterId).toBe('pithag');
			expect(s.game.seats[s.seat('snakecharmer')].characterId).toBe('snakecharmer');
			expect(
				reminderTargetMisses(start.game, charmed, start.seat('pithag'), start.characters)
			).not.toEqual([]);
			expect(
				reminderTargetMisses(start.game, charmed, start.seat('snakecharmer'), start.characters)
			).not.toEqual([]);
		});

		it('Example 2: Snake Charmer targets Vigormortis, and roles swap', () => {
			const s = charms(scenario(['snakecharmer', 'pithag', 'vigormortis', 'chef']), 'vigormortis');
			expect(s.game.seats[s.seat('snakecharmer')]).toMatchObject({
				characterId: 'vigormortis',
				alignment: 'evil'
			});
			expect(s.game.seats[s.seat('vigormortis')]).toMatchObject({
				characterId: 'snakecharmer',
				alignment: 'good'
			});
			expect(poisonedBy(s, 'vigormortis')).toBe(true);
		});

		it('Example 3: Fang Gu swaps with Snake Charmer, both evil', () => {
			// The Pit-Hag made a player the Snake Charmer (an evil one), who then charms the
			// Fang Gu: they swap characters, and both stay evil.
			const start = scenario(['pithag', 'chef', 'fanggu', 'monk']).becomes(
				'chef',
				'snakecharmer',
				'evil'
			);
			const s = charms(start, 'fanggu');
			expect(s.game.seats[s.seat('chef')]).toMatchObject({
				characterId: 'fanggu',
				alignment: 'evil'
			});
			expect(s.game.seats[s.seat('fanggu')]).toMatchObject({
				characterId: 'snakecharmer',
				alignment: 'evil'
			});
			expect(poisonedBy(s, 'fanggu')).toBe(true);
		});
	});
});
