/**
 * Abilities the Storyteller records on a seat without changing its character (`Seat.abilities`):
 * one the player's own `gainedFrom` character gave them, held while their own ability works,
 * and one given by hand (no `via`), which always counts. Both are listed by `abilityHolders`
 * and wake at the held character's place in the night order.
 *
 * Wiki: https://wiki.bloodontheclocktower.com/Philosopher (once per game, at night, the
 * Philosopher may pick a good character and gain its ability; drunk or poisoned, they have
 * no ability)
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, Script } from '#lib/core/data/index.ts';
import type { Game, HeldAbility, SeatId } from '#lib/core/model/types.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import {
	abilitiesOfSeat,
	abilityHolders,
	heldAbilitiesOf,
	withGainedSteps
} from './gained-abilities.ts';
import { nightOrder } from '#lib/core/rules/night/night-order.ts';

const script: Script = {
	meta: { name: 'Given' },
	entries: ['philosopher', 'dreamer', 'chef', 'seamstress', 'imp', 'poisoner', 'empath'].map(
		(id) => ({ kind: 'official' as const, id })
	)
};

/** `game` with `held` recorded on `seatId`, as the Give ability picker writes it. */
const holding = (game: Game, seatId: SeatId, held: HeldAbility): Game => ({
	...game,
	seats: {
		...game.seats,
		[seatId]: { ...game.seats[seatId], abilities: [...(game.seats[seatId].abilities ?? []), held] }
	}
});

/** Tonight's (an other night's) steps with gained steps added, and the sheet order used. */
function otherNight(s: Scenario, game: Game) {
	const data = committedGameData();
	const inPlay = game.seating.flatMap((id) => {
		const c = s.characters.get(game.seats[id].characterId ?? '');
		return c ? [c] : [];
	});
	const order = data.nightSheet.otherNight;
	const steps = nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 5 }).steps;
	return { order, steps: withGainedSteps(steps, game, s.characters, 'other', order) };
}

/** Whether the step for `characterId`'s ability sits at that character's place on the sheet. */
function atPlaceOf(
	steps: readonly { id: string }[],
	order: readonly string[],
	index: number,
	characterId: CharacterId
): boolean {
	const place = order.indexOf(characterId);
	const sheet = (i: number) => order.indexOf(steps[i]?.id ?? '');
	const before = steps.slice(0, index).every((_, i) => sheet(i) < place);
	const after = index + 1 >= steps.length || sheet(index + 1) > place || sheet(index + 1) < 0;
	return before && after;
}

describe('an ability given without changing the character', () => {
	// Seat 0 the Philosopher, 1 the Chef, 2 the Empath, 3 the Imp, 4 the Poisoner.
	const s = scenario(['philosopher', 'chef', 'empath', 'imp', 'poisoner'], { script }).newDay();
	const philosopher = s.seat('philosopher');
	const dreamer = holding(s.game, philosopher, { characterId: 'dreamer', via: 'philosopher' });

	it('lets a Philosopher who chose the Dreamer wake at its step', () => {
		// The Philosopher's page: they gain the chosen good character's ability.
		expect(abilityHolders(dreamer, 'dreamer', s.characters)).toEqual([philosopher]);
		expect(abilitiesOfSeat(dreamer, philosopher, s.characters)).toContainEqual({
			characterId: 'dreamer',
			how: 'held',
			via: 'philosopher'
		});
		expect(heldAbilitiesOf(dreamer, philosopher, s.characters)).toEqual([
			{ characterId: 'dreamer', via: 'philosopher', works: true }
		]);
		const { steps, order } = otherNight(s, dreamer);
		const at = steps.findIndex((step) => step.gained?.characterId === 'dreamer');
		expect(steps[at]).toMatchObject({
			character: { id: 'philosopher' },
			gained: { seatId: philosopher, via: 'philosopher', status: 'has-ability' }
		});
		expect(atPlaceOf(steps, order, at, 'dreamer')).toBe(true);
	});

	it('takes it away while that Philosopher is poisoned', () => {
		// The Philosopher's page: drunk or poisoned, they have no ability.
		const poisoned = holding(s.poisoned('philosopher').game, philosopher, {
			characterId: 'dreamer',
			via: 'philosopher'
		});
		expect(abilityHolders(poisoned, 'dreamer', s.characters)).toEqual([]);
		expect(heldAbilitiesOf(poisoned, philosopher, s.characters)[0]?.works).toBe(false);
		const { steps } = otherNight(s, poisoned);
		expect(steps.some((step) => step.gained?.characterId === 'dreamer')).toBe(false);
	});

	it("doesn't count a Philosopher entry on a seat that isn't the Philosopher", () => {
		const chef = s.seat('chef');
		const wrong = holding(s.game, chef, { characterId: 'dreamer', via: 'philosopher' });
		expect(abilityHolders(wrong, 'dreamer', s.characters)).toEqual([]);
		expect(heldAbilitiesOf(wrong, chef, s.characters)[0]?.works).toBe(false);
	});

	it("wakes a Chef the Storyteller gave the Seamstress's ability at the Seamstress's step", () => {
		const chef = s.seat('chef');
		const given = holding(s.game, chef, { characterId: 'seamstress' });
		expect(abilityHolders(given, 'seamstress', s.characters)).toEqual([chef]);
		expect(abilitiesOfSeat(given, chef, s.characters)).toContainEqual({
			characterId: 'seamstress',
			how: 'held'
		});
		const { steps, order } = otherNight(s, given);
		const at = steps.findIndex((step) => step.gained?.characterId === 'seamstress');
		expect(steps[at]).toMatchObject({
			character: { id: 'chef' },
			gained: { seatId: chef, status: 'has-ability' }
		});
		expect(steps[at]?.gained?.via).toBeUndefined();
		expect(atPlaceOf(steps, order, at, 'seamstress')).toBe(true);
	});

	it('gives and takes away abilities by command, one per giver', () => {
		const chef = s.seat('chef');
		const given = s.do(
			{ type: 'GiveAbility', seatId: chef, ability: { characterId: 'seamstress' } },
			{
				type: 'GiveAbility',
				seatId: philosopher,
				ability: { characterId: 'dreamer', via: 'philosopher' }
			},
			{
				type: 'GiveAbility',
				seatId: philosopher,
				ability: { characterId: 'empath', via: 'philosopher' }
			}
		);
		expect(given.game.seats[chef].abilities).toEqual([{ characterId: 'seamstress' }]);
		expect(given.game.seats[philosopher].abilities).toEqual([
			{ characterId: 'empath', via: 'philosopher' }
		]);
		const taken = given.do({
			type: 'RemoveAbility',
			seatId: chef,
			ability: { characterId: 'seamstress' }
		});
		expect(taken.game.seats[chef].abilities).toBeUndefined();
	});

	it('shows a custom ability text but never wakes or counts it', () => {
		const chef = s.seat('chef');
		const custom = s.do({
			type: 'GiveAbility',
			seatId: chef,
			ability: { text: '  Learns one extra thing tonight ' }
		});
		expect(custom.game.seats[chef].customAbilities).toEqual(['Learns one extra thing tonight']);
		expect(abilitiesOfSeat(custom.game, chef, s.characters)).toEqual([
			{ characterId: 'chef', how: 'own' }
		]);
		expect(heldAbilitiesOf(custom.game, chef, s.characters)).toEqual([]);
		const { steps } = otherNight(s, custom.game);
		expect(steps.some((step) => step.gained !== undefined)).toBe(false);
		expect(steps.length).toBe(otherNight(s, s.game).steps.length);
		const removed = custom.do({
			type: 'RemoveAbility',
			seatId: chef,
			ability: { text: 'Learns one extra thing tonight' }
		});
		expect(removed.game.seats[chef].customAbilities).toBeUndefined();
	});
});
