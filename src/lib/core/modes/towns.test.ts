/**
 * Towns: Two Towns and a Boomdandy (https://ekins.blog/2026/04/29/two-towns-and-a-boomdandy-rules/)
 * and Two games at once (Trevor, 2026-10-17).
 */
import { describe, expect, it } from 'vitest';
import { gameModeById } from './registry.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { ReminderId, Seat, SeatId } from '#lib/core/model/types.ts';
import { canMoveTown, inEveryTown, movesOnDay, moveIntoTown, townSizes } from './towns.ts';

describe('townSizes', () => {
	it('splits as evenly as possible, at most one apart', () => {
		expect(townSizes(12, 2)).toEqual([6, 6]);
		expect(townSizes(13, 2)).toEqual([7, 6]);
	});
});

describe('movesOnDay', () => {
	it('moves 3 after day 1, 2 after days 2 and 3, 1 after days 4 and 5, then none', () => {
		const two = gameModeById('two-towns-and-a-boomdandy')!;
		expect([1, 2, 3, 4, 5, 6].map((d) => movesOnDay(two, d))).toEqual([3, 2, 2, 1, 1, 0]);
		expect(movesOnDay(gameModeById('standard')!, 1)).toBe(0);
	});
});

describe('inEveryTown', () => {
	const mode = gameModeById('two-games-at-once')!;
	it('finds a player who is the Demon in both games', () => {
		expect(
			inEveryTown(mode, [
				{
					playerName: 'Ana',
					characters: [
						{ id: 'imp', type: 'demon' },
						{ id: 'vigormortis', type: 'demon' }
					]
				},
				{
					playerName: 'Ben',
					characters: [
						{ id: 'saint', type: 'outsider' },
						{ id: 'vigormortis', type: 'demon' }
					]
				},
				{ playerName: 'Cy', characters: [{ id: 'imp', type: 'demon' }, undefined] }
			])
		).toEqual([{ playerName: 'Ana', type: 'demon' }]);
	});
});

describe('moving a player to the other town', () => {
	const seat: Seat = {
		seatId: 's1' as SeatId,
		playerName: 'Ana',
		characterId: 'mayor' as CharacterId,
		alignment: 'good',
		dead: false,
		ghostVoteUsed: false,
		overrides: [],
		reminders: [
			{
				reminderId: 'r1' as ReminderId,
				characterId: 'poisoner' as CharacterId,
				label: 'Poisoned' as ReminderLabel
			}
		]
	};

	it('keeps their character, alignment and the reminders on their seat', () => {
		expect(moveIntoTown(seat, 'n1' as SeatId)).toEqual([
			{ type: 'AssignCharacter', seatId: 'n1', characterId: 'mayor', alignment: 'good' },
			{
				type: 'AddReminder',
				seatId: 'n1',
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			}
		]);
	});

	it('only moves living players with a character', () => {
		expect(canMoveTown(seat)).toBe(true);
		expect(canMoveTown({ ...seat, dead: true })).toBe(false);
		expect(canMoveTown({ ...seat, characterId: undefined })).toBe(false);
	});
});
