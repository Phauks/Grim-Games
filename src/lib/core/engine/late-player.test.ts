import { describe, expect, it } from 'vitest';
import { newGame, run, testContext } from '#lib/core/model/fixtures.test-support.ts';
import type { TileSpec } from './commands.ts';
import { dispatch, undo } from './log.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];
const spec = (id: string): TileSpec => ({ shows: id, grimoire: id });

/** Five players, the first two drawn and confirmed (Chef, Recluse), the rest in the bag. */
function midDraw() {
	const { session, ctx, seats } = newGame(names, { ctx: testContext() });
	const bagged = run(session, ctx, {
		type: 'BuildBag',
		tiles: ['chef', 'recluse', 'empath', 'poisoner', 'imp'].map(spec),
		includeTravellers: false,
		shuffle: false
	});
	const [chef, recluse] = bagged.game.bag!.order;
	const drawn = run(
		bagged,
		ctx,
		{ type: 'DrawTile', seatId: seats[0], tileId: chef },
		{ type: 'ConfirmDraw', tileId: chef },
		{ type: 'DrawTile', seatId: seats[1], tileId: recluse },
		{ type: 'ConfirmDraw', tileId: recluse }
	);
	return { session: drawn, ctx, seats };
}

const inBag = (game: ReturnType<typeof midDraw>['session']['game']) =>
	game.bag!.order.map((id) => game.bag!.tiles[id].grimoire).sort();

// The fair late seat (Trevor, 2026-10-30): a late player joins as one more player instead of
// as a Traveller (https://wiki.bloodontheclocktower.com/Travellers).
describe('AddLatePlayer', () => {
	it('adds a seat and fills the bag for one more player, keeping matching tiles', () => {
		const { session, ctx } = midDraw();
		const before = session.game.bag!.order;
		const s = run(session, ctx, {
			type: 'AddLatePlayer',
			players: [{ playerName: 'Max' }],
			changes: [],
			bag: ['empath', 'poisoner', 'imp', 'saint'].map(spec)
		});
		expect(s.game.seating).toHaveLength(6);
		expect(s.game.seats[s.game.seating[5]].playerName).toBe('Max');
		expect(inBag(s.game)).toEqual(['empath', 'imp', 'poisoner', 'saint']);
		for (const id of before) expect(s.game.bag!.order).toContain(id);
	});

	it('seats several late players where the Storyteller placed them', () => {
		const { session, ctx, seats } = midDraw();
		const s = run(session, ctx, {
			type: 'AddLatePlayer',
			players: [
				{ playerName: 'Max', position: 1 },
				{ playerName: 'Noa', position: 1 },
				{ playerName: 'Ola', position: 5 }
			],
			changes: [{ seatId: seats[1], characterId: 'spy' }],
			bag: ['empath', 'poisoner', 'imp', 'saint', 'monk', 'soldier'].map(spec)
		});
		const names = s.game.seating.map((id) => s.game.seats[id].playerName);
		expect(names).toEqual(['Ana', 'Max', 'Noa', 'Ben', 'Cat', 'Dev', 'Eve', 'Ola']);
		expect(s.game.bag!.order).toHaveLength(6);
		// Ben is fourth once Max and Noa sit before him.
		expect(s.game.nightOrderOverrides.at(-1)).toMatchObject({
			text: expect.stringContaining('Ben')
		});
	});

	it('changes a drawn player: their tile, their seat and a first-night "You are" step', () => {
		const { session, ctx, seats } = midDraw();
		const s = run(session, ctx, {
			type: 'AddLatePlayer',
			players: [{}],
			changes: [{ seatId: seats[1], characterId: 'spy' }],
			bag: ['empath', 'poisoner', 'imp', 'washerwoman'].map(spec)
		});
		const tile = Object.values(s.game.bag!.tiles).find((t) => t.drawnBySeat === seats[1])!;
		expect(tile.grimoire).toBe('spy');
		expect(s.game.seats[seats[1]].characterId).toBe('spy');
		// The Recluse was good; the Spy is a Minion, so evil.
		expect(s.game.seats[seats[1]].alignment).toBe('evil');
		const step = s.game.nightOrderOverrides.at(-1)!;
		expect(step).toMatchObject({ kind: 'add', characterId: 'spy', after: 'dusk', night: 'first' });
	});

	it('recasts, removes and adds bag tiles to match the new bag', () => {
		const { session, ctx } = midDraw();
		const s = run(session, ctx, {
			type: 'AddLatePlayer',
			players: [{}],
			changes: [],
			bag: ['empath', 'spy', 'imp', 'monk', 'soldier'].map(spec)
		});
		expect(inBag(s.game)).toEqual(['empath', 'imp', 'monk', 'soldier', 'spy']);
		const fewer = run(session, ctx, {
			type: 'AddLatePlayer',
			players: [{}],
			changes: [],
			bag: ['imp'].map(spec)
		});
		expect(inBag(fewer.game)).toEqual(['imp']);
	});

	it('changes a player still holding their tile only on the tile', () => {
		const { session, ctx, seats } = midDraw();
		const held = run(session, ctx, { type: 'DrawTile', seatId: seats[2] });
		const s = run(held, ctx, {
			type: 'AddLatePlayer',
			players: [{}],
			changes: [{ seatId: seats[2], characterId: 'monk' }],
			bag: ['poisoner', 'imp', 'saint'].map(spec)
		});
		const tile = Object.values(s.game.bag!.tiles).find((t) => t.drawnBySeat === seats[2])!;
		expect(tile.grimoire).toBe('monk');
		expect(tile.confirmed).toBe(false);
		expect(s.game.seats[seats[2]].characterId).toBeUndefined();
	});

	it('is one step to undo', () => {
		const { session, ctx, seats } = midDraw();
		const s = run(session, ctx, {
			type: 'AddLatePlayer',
			players: [{}],
			changes: [{ seatId: seats[1], characterId: 'spy' }],
			bag: ['empath', 'poisoner', 'imp', 'washerwoman'].map(spec)
		});
		const back = undo(s);
		expect(back.game).toEqual(session.game);
	});

	it('needs a bag', () => {
		const { session, ctx } = newGame(names, { ctx: testContext() });
		const none = dispatch(
			session,
			{ type: 'AddLatePlayer', players: [{}], changes: [], bag: [] },
			ctx
		);
		expect(none.ok).toBe(false);
	});
});
