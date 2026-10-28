/**
 * Everything a seat held during a game counts (Trevor, 2026-10-27: a changed character or
 * alignment "should count as unlocking anything they touch"). Rules sources:
 * - https://wiki.bloodontheclocktower.com/Pit-Hag (changes a player's character mid-game,
 *   here done by the Storyteller's own reassignment, as the grimoire records it)
 * - https://wiki.bloodontheclocktower.com/Alignment (a player's alignment can change while
 *   their character stays the same)
 * - https://wiki.bloodontheclocktower.com/Glossary, "Win" (a player wins when their team wins,
 *   whatever their character)
 */
import { describe, expect, it } from 'vitest';
import { toSavedGame } from '#lib/core/engine/index.ts';
import { gameData, newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { deriveGameRecord } from '#lib/core/stats/index.ts';
import { charactersOf, earned } from './engine.ts';
import { pointsEarned } from './points.ts';
import type { Achievement, TakenPart } from './types.ts';

function playedGame() {
	const { session, ctx, seats } = newGame(['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay']);
	const [ana, ben, cat, dev, eve, fay] = seats;
	const s = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: ana, characterId: 'imp' },
		{ type: 'AssignCharacter', seatId: ben, characterId: 'poisoner' },
		{ type: 'AssignCharacter', seatId: cat, characterId: 'chef' },
		{ type: 'AssignCharacter', seatId: dev, characterId: 'empath' },
		{ type: 'AssignCharacter', seatId: eve, characterId: 'saint' },
		{ type: 'AssignCharacter', seatId: fay, characterId: 'washerwoman' },
		{ type: 'NewDay' },
		// Cat is made the Monk for a night, then the Chef again.
		{ type: 'AssignCharacter', seatId: cat, characterId: 'monk' },
		{ type: 'NewDay' },
		{ type: 'AssignCharacter', seatId: cat, characterId: 'chef' },
		// Dev turns evil, still the Empath.
		{ type: 'SetAlignment', seatId: dev, alignment: 'evil' },
		{ type: 'NewDay' }
	);
	const record = deriveGameRecord(toSavedGame(s, 1), { endedAt: 5, winner: 'evil' }, gameData);
	return { record, seats };
}

describe('characters and alignments held mid-game', () => {
	it('records a character the seat had only in the middle of the game', () => {
		const { record, seats } = playedGame();
		const cat = record.seats.find((seat) => seat.seatId === seats[2]);
		expect(cat?.start?.characterId).toBe('chef');
		expect(cat?.end?.characterId).toBe('chef');
		expect(cat?.held?.map((c) => c.characterId)).toEqual(['chef', 'monk', 'chef']);
		expect(charactersOf({ record, seatId: seats[2] })).toEqual(['chef', 'monk']);
		// A seat that never changed keeps no list.
		expect(record.seats[0].held).toBeUndefined();
	});

	it('counts the middle character for "played as" and for a first-time points bonus', () => {
		const { record, seats } = playedGame();
		const cat: TakenPart = { record, seatId: seats[2] };
		const asMonk: Achievement = {
			id: 'played-as:monk',
			criteria: { kind: 'playedAs', character: 'monk' },
			unlocks: [{ part: 'medallion', option: 'character:monk' }]
		};
		expect(earned([asMonk], [cat])).toHaveLength(1);
		const bonus = pointsEarned([{ id: 'new', kind: 'newCharacter', points: 5 }], [cat]);
		expect(bonus).toHaveLength(1);
	});

	it('earns "changed alignment" and a win as a Townsfolk on the evil team', () => {
		const { record, seats } = playedGame();
		const dev: TakenPart = { record, seatId: seats[3] };
		const turned: Achievement = {
			id: 'turned',
			criteria: { kind: 'changed', what: 'alignment' },
			unlocks: [{ part: 'accent', option: 'two-tone' }]
		};
		const wonTownsfolk: Achievement = {
			id: 'won-townsfolk',
			criteria: { kind: 'playedType', type: 'townsfolk', won: true },
			unlocks: [{ part: 'motion', option: 'sway' }]
		};
		expect(earned([turned, wonTownsfolk], [dev]).map((e) => e.id)).toEqual([
			'turned',
			'won-townsfolk'
		]);
		// Fay stayed a good Washerwoman, so evil's win is not hers.
		const fay: TakenPart = { record, seatId: seats[5] };
		expect(earned([turned, wonTownsfolk], [fay])).toEqual([]);
	});

	it('pays the same points to winners and losers of the same game', () => {
		const { record, seats } = playedGame();
		const perGame = [{ id: 'game', kind: 'perGame' as const, points: 10 }];
		expect(pointsEarned(perGame, [{ record, seatId: seats[0] }])).toEqual(
			pointsEarned(perGame, [{ record, seatId: seats[5] }])
		);
	});
});
