import { describe, expect, it } from 'vitest';
import {
	newGame,
	run,
	testCharacters,
	testContext
} from '#lib/core/model/fixtures.test-support.ts';
import { scenario } from '#lib/core/testing/scenario.ts';
import { parseSeatRole, roleGaps, roleKey, seatRoles } from './seat-roles.ts';

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

	it('tells a player an alignment the Storyteller changed, and a Traveller only theirs', () => {
		const { session, ctx, seats } = newGame(2);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef', alignment: 'evil' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'scapegoat', alignment: 'good' }
		).game;
		expect(seatRoles(game, testCharacters)).toEqual({
			[seats[0]]: { characterId: 'chef', alignment: 'evil' },
			// https://wiki.bloodontheclocktower.com/Travellers: the town knows who a Traveller is.
			[seats[1]]: { alignment: 'good' }
		});
	});

	// https://wiki.bloodontheclocktower.com/Marionette: they think they are good, so their
	// phone must not say they are evil (M22).
	it('never tells the Marionette they are evil', () => {
		const s = scenario(['chef', 'imp', 'empath'])
			.reminder('chef', 'marionette', 'Is The Marionette')
			.do((at) => ({ type: 'SetAlignment', seatId: at.seat('chef'), alignment: 'evil' }));
		expect(seatRoles(s.game, s.characters)[s.seat('chef')]).toEqual({ characterId: 'chef' });
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
	});

	it('leaves out a Traveller whose alignment is not chosen yet', () => {
		const { session, ctx, seats } = newGame(1);
		const game = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'scapegoat'
		}).game;
		expect(game.seats[seats[0]].alignment).toBeUndefined();
		expect(seatRoles(game, testCharacters)).toEqual({});
	});

	it('leaves out a character shown something else when no tile says what', () => {
		const { session, ctx, seats } = newGame(1);
		const game = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'lunatic'
		}).game;
		expect(seatRoles(game, testCharacters)).toEqual({});
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

// Trevor, 2026-10-31: showing players their characters says who won't see one.
describe('who won’t see a character when they are shown', () => {
	it('lists seats with no character, a hidden one, no Traveller alignment, or no phone', () => {
		const { session, ctx, seats } = newGame(5);
		const game = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			// https://wiki.bloodontheclocktower.com/Lunatic: never shown the truth.
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'lunatic' },
			// https://wiki.bloodontheclocktower.com/Travellers: the alignment is the secret.
			{ type: 'AssignCharacter', seatId: seats[2], characterId: 'scapegoat' },
			{ type: 'AssignCharacter', seatId: seats[3], characterId: 'imp' }
		).game;
		const phones = new Set([seats[0], seats[1], seats[2], seats[4]]);
		expect(roleGaps(game, testCharacters, phones)).toEqual([
			{ seatId: seats[1], gaps: ['withheld'] },
			{ seatId: seats[2], gaps: ['no-alignment'] },
			{ seatId: seats[3], gaps: ['no-phone'] },
			{ seatId: seats[4], gaps: ['no-character'] }
		]);
	});

	it('gives every reason a seat has, and nothing when all will see theirs', () => {
		const { session, ctx, seats } = newGame(2);
		const game = run(session, ctx, {
			type: 'AssignCharacter',
			seatId: seats[0],
			characterId: 'chef'
		}).game;
		expect(roleGaps(game, testCharacters, new Set([seats[0]]))).toEqual([
			{ seatId: seats[1], gaps: ['no-character', 'no-phone'] }
		]);
		expect(roleGaps(game, testCharacters, new Set(seats)).map((g) => g.gaps)).toEqual([
			['no-character']
		]);
	});
});
