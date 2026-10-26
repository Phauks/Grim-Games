import { describe, expect, it } from 'vitest';
import {
	newGame,
	run,
	testCharacters,
	testContext
} from '#lib/core/model/fixtures.test-support.ts';
import { parseSeatRole, roleKey, seatRoles, withheldSeats } from './seat-roles.ts';

describe('the character each phone shows its player', () => {
	it('is the seat’s character, with no alignment when it is the character’s own', () => {
		const { session, ctx, seats } = newGame(3);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'imp' }
		).game;
		expect(seatRoles(game, testCharacters)).toEqual({
			[seats[0]]: { characterId: 'chef' },
			[seats[1]]: { characterId: 'imp' }
		});
	});

	it('tells a player an alignment the Storyteller changed, and a Traveller theirs', () => {
		const { session, ctx, seats } = newGame(2);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef', alignment: 'evil' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'scapegoat', alignment: 'good' }
		).game;
		expect(seatRoles(game, testCharacters)).toEqual({
			[seats[0]]: { characterId: 'chef', alignment: 'evil' },
			[seats[1]]: { characterId: 'scapegoat', alignment: 'good' }
		});
	});

	// https://wiki.bloodontheclocktower.com/Lunatic: the Lunatic is shown a Demon token.
	it('shows what a bag tile showed, never the grimoire character', () => {
		const { session, ctx, seats } = newGame(1, { ctx: testContext() });
		const built = run(session, ctx, {
			type: 'BuildBag',
			tiles: [{ shows: 'imp', grimoire: 'lunatic' }],
			includeTravellers: false
		});
		const tileId = built.game.bag!.order[0];
		const game = run(
			built,
			ctx,
			{ type: 'DrawTile', seatId: seats[0], tileId },
			{ type: 'ConfirmDraw', tileId }
		).game;
		expect(game.seats[seats[0]].characterId).toBe('lunatic');
		expect(seatRoles(game, testCharacters)).toEqual({ [seats[0]]: { characterId: 'imp' } });
		expect(withheldSeats(game, testCharacters)).toEqual([]);
	});

	it('leaves out a character shown something else when no tile says what', () => {
		const { session, ctx, seats } = newGame(1);
		const game = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'lunatic'
		}).game;
		expect(seatRoles(game, testCharacters)).toEqual({});
		expect(withheldSeats(game, testCharacters)).toEqual([seats[0]]);
	});

	it('follows the seat once its character changes after the draw', () => {
		const { session, ctx, seats } = newGame(1);
		const built = run(session, ctx, {
			type: 'BuildBag',
			tiles: [{ shows: 'imp', grimoire: 'lunatic' }],
			includeTravellers: false
		});
		const tileId = built.game.bag!.order[0];
		const game = run(
			built,
			ctx,
			{ type: 'DrawTile', seatId: seats[0], tileId },
			{ type: 'ConfirmDraw', tileId },
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' }
		).game;
		expect(seatRoles(game, testCharacters)).toEqual({ [seats[0]]: { characterId: 'chef' } });
	});
});

describe('roles from a device', () => {
	it('keeps a character, an alignment, or both, and drops anything else', () => {
		expect(parseSeatRole({ characterId: 'chef', extra: 1 })).toEqual({ characterId: 'chef' });
		expect(parseSeatRole({ alignment: 'evil' })).toEqual({ alignment: 'evil' });
		expect(parseSeatRole({ alignment: 'neutral' })).toBeUndefined();
		expect(parseSeatRole({ characterId: 'x'.repeat(81) })).toBeUndefined();
		expect(parseSeatRole('chef')).toBeUndefined();
	});

	it('tells roles apart by character and alignment', () => {
		expect(roleKey({ characterId: 'chef' })).not.toBe(
			roleKey({ characterId: 'chef', alignment: 'evil' })
		);
	});
});
