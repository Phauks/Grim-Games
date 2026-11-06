/**
 * The `learns` building blocks (M60, `data/night-info-rules.ts`): a count, players shown or a
 * yes/no over a group of players. The Chef, Empath, Steward, Noble, Knight, Bounty Hunter,
 * Choirboy, Fortune Teller and Chambermaid are presets of them. Part of `picker.ts`.
 */
import type { Learns, LearnsBlock } from '#lib/core/data/character-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { aliveNeighbours } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { RegistrationWorld } from '../ability.ts';
import { carries } from './token-carriers.ts';
import { neighbourPairs } from './neighbour-pairs.ts';
import type { InfoOption } from './picker.ts';

/** A building block as the picker reads it. */
export type BlockSpec = Learns & {
	measure: LearnsBlock;
	/** For `woke`: the players who woke tonight by their own ability. */
	wokeSeats?: ReadonlySet<SeatId>;
};

interface BlockContext {
	game: Game;
	seatId: SeatId;
	characterId: CharacterId;
	characters: CharacterLookup;
	world: RegistrationWorld;
}

/** Every unordered selection of `k` items, in order. */
export function choose<T>(items: readonly T[], k: number): T[][] {
	if (k === 0) return [[]];
	if (items.length < k) return [];
	const [first, ...rest] = items;
	return [...choose(rest, k - 1).map((c) => [first, ...c]), ...choose(rest, k)];
}

/** Whether a player counts: they register as everything the block names, or carry its token. */
function matcher(spec: BlockSpec, { game, characterId, world }: BlockContext) {
	const named = spec.alignment || spec.types || spec.woke;
	return (s: SeatId) => {
		if (spec.token && carries(game, s, characterId, spec.token)) return true;
		if (!named) return false;
		const type = world.type(s);
		return (
			(!spec.alignment || world.alignment(s) === spec.alignment) &&
			(!spec.types || (type !== undefined && spec.types.includes(type))) &&
			(!spec.woke || (spec.wokeSeats?.has(s) ?? false))
		);
	};
}

/** The players a block chooses or shows from: the others (or everyone), alive with `alive`. */
function pool(spec: BlockSpec, { game, seatId }: BlockContext): SeatId[] {
	return game.seating.filter(
		(s) => (spec.self || s !== seatId) && (!spec.alive || !game.seats[s].dead)
	);
}

/** The truthful options of a building block when players register as `world` says. */
export function blockOptions(spec: BlockSpec, ctx: BlockContext): InfoOption[] {
	const match = matcher(spec, ctx);
	const n = spec.choose ?? 0;
	switch (spec.measure) {
		case 'count':
			if (spec.scope === 'alive-neighbours') {
				return [{ seats: [], number: neighboursOf(ctx).filter(match).length }];
			}
			if (spec.scope === 'neighbour-pairs') {
				const pairs = neighbourPairs(ctx.game).filter(([a, b]) => match(a) && match(b));
				return [{ seats: [], number: pairs.length }];
			}
			if (!n) return [{ seats: [], number: pool(spec, ctx).filter(match).length }];
			return choose(pool(spec, ctx), n).map((seats) => ({
				seats,
				number: seats.filter(match).length
			}));
		case 'players': {
			const wanted = spec.matching ?? n;
			return choose(pool(spec, ctx), n).flatMap((seats) => {
				const matched = seats.filter(match);
				if (matched.length !== wanted) return [];
				return [{ seats, ...(matched.length === 1 ? { pivot: matched[0] } : {}) }];
			});
		}
		case 'any-of':
			return choose(pool(spec, ctx), n).map((seats) => ({ seats, yes: seats.some(match) }));
	}
}

function neighboursOf({ game, seatId, characters }: BlockContext): SeatId[] {
	return aliveNeighbours(game, seatId, characters);
}

/**
 * The players a block's answer is worked out from: the alive neighbours it looks at, or the
 * players who match.
 */
export function blockFacts(spec: BlockSpec, ctx: BlockContext): SeatId[] {
	if (spec.scope === 'alive-neighbours') return neighboursOf(ctx);
	const match = matcher(spec, ctx);
	const from = spec.scope === 'neighbour-pairs' ? ctx.game.seating : pool(spec, ctx);
	return from.filter(match);
}

/** The highest number a `count` block can show. */
export function blockHighest(spec: BlockSpec, game: Game): number {
	if (spec.scope === 'alive-neighbours') return 2;
	return spec.choose || game.seating.length;
}
