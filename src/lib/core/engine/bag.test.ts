import { describe, expect, it } from 'vitest';
import { trueCharacter } from '#lib/core/model/index.ts';
import {
	newGame,
	run,
	testCharacters,
	testContext
} from '#lib/core/model/fixtures.test-support.ts';
import type { TileSpec } from './commands.ts';
import { dispatch, undo } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

// https://wiki.bloodontheclocktower.com/Drunk: the Drunk's token is not put in the bag; a
// Townsfolk token goes in instead. https://wiki.bloodontheclocktower.com/Lunatic: the
// Lunatic is shown a Demon token.
const tiles: TileSpec[] = [
	{ shows: 'chef', grimoire: 'chef' },
	{
		shows: 'empath',
		grimoire: 'empath',
		reminders: [{ characterId: 'drunk', label: 'Is The Drunk' }]
	},
	{ shows: 'imp', grimoire: 'lunatic' },
	{ shows: 'baron', grimoire: 'baron' },
	{ shows: 'imp', grimoire: 'imp' }
];

function withBag(options: { shuffle?: boolean; random?: number[] } = {}) {
	const { session, ctx, seats } = newGame(names, { ctx: testContext({ random: options.random }) });
	const bagged = run(session, ctx, {
		type: 'BuildBag',
		tiles,
		includeTravellers: false,
		shuffle: options.shuffle
	});
	return { session: bagged, ctx, seats };
}

describe('BuildBag', () => {
	it('stores tiles with what the player sees and what goes in the grimoire', () => {
		const { session } = withBag({ shuffle: false });
		const bag = session.game.bag!;
		expect(bag.includeTravellers).toBe(false);
		expect(bag.order.map((id) => bag.tiles[id].shows)).toEqual([
			'chef',
			'empath',
			'imp',
			'baron',
			'imp'
		]);
		const lunatic = bag.tiles[bag.order[2]];
		expect(lunatic).toEqual({
			tileId: bag.order[2],
			shows: 'imp',
			grimoire: 'lunatic',
			reminders: [],
			confirmed: false
		});
	});

	it('shuffles with the injected random source, deterministically', () => {
		const a = withBag({ random: [0.1, 0.9, 0.5, 0.3] }).session.game.bag!;
		const b = withBag({ random: [0.1, 0.9, 0.5, 0.3] }).session.game.bag!;
		expect(a.order).toEqual(b.order);
		expect(a.order.map((id) => a.tiles[id].grimoire)).not.toEqual([
			'chef',
			'empath',
			'lunatic',
			'baron',
			'imp'
		]);
		expect([...a.order].sort()).toEqual(Object.keys(a.tiles).sort());
	});

	it('warns about Travellers, off-script characters, unknown reminders and replacing a drawn bag', () => {
		const { session, ctx, seats } = withBag({ shuffle: false });
		const drawn = run(session, ctx, { type: 'DrawTile', seatId: seats[0] });
		const result = dispatch(
			drawn,
			{
				type: 'BuildBag',
				includeTravellers: false,
				tiles: [
					{ shows: 'beggar', grimoire: 'beggar' },
					{ shows: 'clockmaker', grimoire: 'clockmaker' },
					{ shows: 'chef', grimoire: 'chef', reminders: [{ characterId: 'chef', label: 'Nope' }] }
				]
			},
			ctx
		);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.warnings.map((w) => w.code)).toEqual([
			'bag-replaced',
			'traveller-in-bag',
			'not-on-script',
			'not-on-script',
			'reminder-not-for-character'
		]);
	});

	it('refuses Fabled tiles and unknown characters, and can be cleared', () => {
		const { session, ctx } = withBag();
		const fabled = dispatch(
			session,
			{
				type: 'BuildBag',
				includeTravellers: false,
				tiles: [{ shows: 'djinn', grimoire: 'djinn' }]
			},
			ctx
		);
		expect(fabled.ok ? 'ok' : fabled.error.code).toBe('not-seatable');
		const unknown = dispatch(
			session,
			{ type: 'BuildBag', includeTravellers: false, tiles: [{ shows: 'x', grimoire: 'chef' }] },
			ctx
		);
		expect(unknown.ok ? 'ok' : unknown.error.code).toBe('unknown-character');
		const cleared = run(session, ctx, { type: 'ClearBag' });
		expect(cleared.game.bag).toBeUndefined();
		const again = dispatch(cleared, { type: 'ClearBag' }, ctx);
		expect(again.ok && again.warnings.map((w) => w.code)).toEqual(['no-change']);
	});
});

describe('drawing', () => {
	it('draws the next tile, or a chosen one, and takes it out of the bag', () => {
		const { session, ctx, seats } = withBag({ shuffle: false });
		const order = session.game.bag!.order;
		const s = run(
			session,
			ctx,
			{ type: 'DrawTile', seatId: seats[0] },
			{ type: 'DrawTile', seatId: seats[1], tileId: order[3] }
		);
		const bag = s.game.bag!;
		expect(bag.tiles[order[0]].drawnBySeat).toBe(seats[0]);
		expect(bag.tiles[order[3]].drawnBySeat).toBe(seats[1]);
		expect(bag.order).toEqual([order[1], order[2], order[4]]);
		// Drawing alone puts nothing in the grimoire.
		expect(s.game.seats[seats[0]].characterId).toBeUndefined();
	});

	it('confirms a draw: the grimoire character, its alignment and its reminders go on the seat', () => {
		const { session, ctx, seats } = withBag({ shuffle: false });
		const order = session.game.bag!.order;
		const s = run(
			session,
			ctx,
			{ type: 'DrawTile', seatId: seats[0], tileId: order[1] },
			{ type: 'ConfirmDraw', tileId: order[1] },
			{ type: 'DrawTile', seatId: seats[1], tileId: order[2] },
			{ type: 'ConfirmDraw', tileId: order[2] }
		);
		const drunk = s.game.seats[seats[0]];
		expect(drunk.characterId).toBe('empath');
		expect(drunk.alignment).toBe('good');
		expect(drunk.reminders.map((r) => r.label)).toEqual(['Is The Drunk']);
		expect(trueCharacter(s.game, seats[0], testCharacters)).toBe('drunk');
		expect(s.game.bag!.tiles[order[1]].confirmed).toBe(true);
		// The Lunatic saw the Imp; the grimoire has the Lunatic, who is good.
		expect(s.game.seats[seats[1]]).toMatchObject({ characterId: 'lunatic', alignment: 'good' });
		// Confirming is one command, so one undo takes it all back.
		const undone = undo(s);
		expect(undone.game.seats[seats[1]].characterId).toBeUndefined();
		expect(undone.game.bag!.tiles[order[2]]).toMatchObject({
			drawnBySeat: seats[1],
			confirmed: false
		});
	});

	it('gives a Marionette tile the Marionette alignment, not the shown Townsfolk', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{
				type: 'BuildBag',
				includeTravellers: false,
				shuffle: false,
				tiles: [
					{
						shows: 'chef',
						grimoire: 'chef',
						reminders: [{ characterId: 'marionette', label: 'Is The Marionette' }]
					}
				]
			},
			{ type: 'DrawTile', seatId: seats[0] }
		);
		const tileId = Object.keys(s.game.bag!.tiles)[0];
		const confirmed = run(s, ctx, { type: 'ConfirmDraw', tileId });
		expect(confirmed.game.seats[seats[0]].alignment).toBe('evil');
	});

	it('needs an alignment to confirm a Traveller, and warns when replacing a character', () => {
		const { session, ctx, seats } = newGame(names);
		const s = run(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'chef' },
			{
				type: 'BuildBag',
				includeTravellers: true,
				tiles: [{ shows: 'beggar', grimoire: 'beggar' }]
			},
			{ type: 'DrawTile', seatId: seats[0] }
		);
		const tileId = Object.keys(s.game.bag!.tiles)[0];
		const missing = dispatch(s, { type: 'ConfirmDraw', tileId }, ctx);
		expect(missing.ok ? 'ok' : missing.error.code).toBe('traveller-needs-alignment');
		const confirmed = dispatch(s, { type: 'ConfirmDraw', tileId, alignment: 'evil' }, ctx);
		if (!confirmed.ok) throw new Error();
		expect(confirmed.warnings.map((w) => w.code)).toEqual(['replaces-character']);
		expect(confirmed.session.game.seats[seats[0]]).toMatchObject({
			characterId: 'beggar',
			alignment: 'evil'
		});
	});

	it('returns a cancelled tile to a random place in the bag', () => {
		const { session, ctx, seats } = withBag({ shuffle: false, random: [0.99] });
		const order = session.game.bag!.order;
		const s = run(
			session,
			ctx,
			{ type: 'DrawTile', seatId: seats[0] },
			{ type: 'CancelDraw', tileId: order[0] }
		);
		const bag = s.game.bag!;
		expect(bag.tiles[order[0]].drawnBySeat).toBeUndefined();
		expect(bag.tiles[order[0]].confirmed).toBe(false);
		expect(bag.order).toEqual([...order.slice(1), order[0]]);
	});

	it('refuses draws that cannot happen', () => {
		const { session, ctx, seats } = withBag({ shuffle: false });
		const order = session.game.bag!.order;
		const code = (r: ReturnType<typeof dispatch>) => (r.ok ? 'ok' : r.error.code);
		const noBag = newGame(names);
		expect(
			code(dispatch(noBag.session, { type: 'DrawTile', seatId: noBag.seats[0] }, noBag.ctx))
		).toBe('no-bag');
		expect(code(dispatch(noBag.session, { type: 'CancelDraw', tileId: 'x' }, noBag.ctx))).toBe(
			'no-bag'
		);
		expect(code(dispatch(session, { type: 'DrawTile', seatId: 'x' }, ctx))).toBe('unknown-seat');
		expect(code(dispatch(session, { type: 'DrawTile', seatId: seats[0], tileId: 'x' }, ctx))).toBe(
			'unknown-tile'
		);
		expect(code(dispatch(session, { type: 'ConfirmDraw', tileId: order[0] }, ctx))).toBe(
			'tile-not-drawn'
		);
		expect(code(dispatch(session, { type: 'CancelDraw', tileId: order[0] }, ctx))).toBe(
			'tile-not-drawn'
		);
		const drawn = run(session, ctx, { type: 'DrawTile', seatId: seats[0] });
		expect(
			code(dispatch(drawn, { type: 'DrawTile', seatId: seats[1], tileId: order[0] }, ctx))
		).toBe('tile-not-in-bag');
		const held = dispatch(drawn, { type: 'DrawTile', seatId: seats[0] }, ctx);
		expect(held.ok && held.warnings.map((w) => w.code)).toEqual(['seat-holds-tile']);
		const confirmed = run(drawn, ctx, { type: 'ConfirmDraw', tileId: order[0] });
		expect(code(dispatch(confirmed, { type: 'ConfirmDraw', tileId: order[0] }, ctx))).toBe(
			'tile-confirmed'
		);
		expect(code(dispatch(confirmed, { type: 'CancelDraw', tileId: order[0] }, ctx))).toBe(
			'tile-confirmed'
		);
		let empty = confirmed;
		for (let i = 0; i < 4; i++) empty = run(empty, ctx, { type: 'DrawTile', seatId: seats[i + 1] });
		expect(code(dispatch(empty, { type: 'DrawTile', seatId: seats[0] }, ctx))).toBe('bag-empty');
	});

	it('puts the tile back when the player holding it leaves', () => {
		const { session, ctx, seats } = withBag({ shuffle: false, random: [0] });
		const order = session.game.bag!.order;
		const drawn = run(session, ctx, { type: 'DrawTile', seatId: seats[0] });
		const removed = dispatch(drawn, { type: 'RemoveSeat', seatId: seats[0] }, ctx);
		if (!removed.ok) throw new Error();
		expect(removed.warnings.map((w) => w.code)).toEqual(['draw-cancelled']);
		expect(removed.session.game.bag!.order).toEqual(order);
	});
});
