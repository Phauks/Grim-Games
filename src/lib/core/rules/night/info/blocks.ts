/**
 * The `learns` building blocks (M60, M78, `data/parts/learns.ts`): a count, players shown,
 * a yes/no, a character, a direction or a distance over a group of players. Every official
 * character that learns something is a preset of one, but the Sage and Balloonist. Part of
 * `picker.ts`.
 */
import type { Learns, LearnsBlock } from '#lib/core/data/character-rules.ts';
import type { CharacterId } from '#lib/core/data/types.ts';
import { type CharacterLookup, scriptCharacterIds } from '#lib/core/model/characters.ts';
import {
	aliveNeighbours,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import type { RegistrationWorld } from '#lib/core/rules/abilities/registration.ts';
import { carries, lastShown } from './token-carriers.ts';
import { mostPairs, neighbourPairs } from './neighbour-pairs.ts';
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

/**
 * Whether a player counts: they register as everything the block names, or carry its token.
 * With `differsFromToken`, their type differs from every type of the players last shown
 * (those carrying that token). With `killer`, only the players who match and whose character
 * the waking player's death is recorded as, when any (the Demon that killed them).
 */
function matcher(spec: BlockSpec, ctx: BlockContext) {
	const { game, seatId, characterId, characters, world } = ctx;
	const named = spec.alignment || spec.types || spec.woke || spec.differsFromToken;
	const before = spec.differsFromToken
		? lastShown(game, seatId, characterId, spec.differsFromToken).map((s) => world.type(s))
		: [];
	const base = (s: SeatId) => {
		if (spec.token && carries(game, s, characterId, spec.token)) return true;
		if (!named) return false;
		const type = world.type(s);
		return (
			(!spec.alignment || world.alignment(s) === spec.alignment) &&
			(!spec.types || (type !== undefined && spec.types.includes(type))) &&
			(!spec.woke || (spec.wokeSeats?.has(s) ?? false)) &&
			(!spec.differsFromToken || !before.includes(type))
		);
	};
	const cause = spec.killer ? game.seats[seatId]?.deathCause : undefined;
	if (cause === undefined) return base;
	const killers = game.seating.filter(
		(s) => s !== seatId && base(s) && trueCharacter(game, s, characters) === cause
	);
	return killers.length > 0 ? (s: SeatId) => killers.includes(s) : base;
}

const namesWho = (spec: BlockSpec) =>
	!!(spec.alignment || spec.types || spec.woke || spec.token || spec.differsFromToken);

/**
 * The players a block chooses or shows from: the others (or everyone), only those who register
 * as alive with `alive`.
 */
function pool(spec: BlockSpec, { game, seatId, characters }: BlockContext): SeatId[] {
	return game.seating.filter(
		(s) => (spec.self || s !== seatId) && (!spec.alive || !registersAsDead(game, s, characters))
	);
}

/** The character a player is shown as: their own, or any of the type they register as. */
function shownAs(
	s: SeatId,
	{ game, characters, world }: BlockContext
): Pick<InfoOption, 'characterId' | 'characterIds'> {
	const type = world.type(s);
	if (typeOf(game, s, characters) === type) {
		return { characterId: trueCharacter(game, s, characters)! };
	}
	return {
		characterIds: scriptCharacterIds(game.script).filter((id) => characters.get(id)?.type === type)
	};
}

/** Steps round the circle between two seat indexes, the shorter way. */
const stepsBetween = (a: number, b: number, n: number) =>
	Math.min(Math.abs(a - b), n - Math.abs(a - b));

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
				if (spec.atLeast ? matched.length < wanted : matched.length !== wanted) return [];
				return [{ seats, ...(matched.length === 1 ? { pivot: matched[0] } : {}) }];
			});
		}
		case 'any-of':
			return choose(pool(spec, ctx), n).map((seats) => ({ seats, yes: seats.some(match) }));
		case 'character':
			return characterOptions(spec, ctx, match);
		case 'same': {
			const evil = (s: SeatId) => ctx.world.alignment(s) === 'evil';
			return choose(pool(spec, ctx), n).map((seats) => ({
				seats,
				yes: seats.every((s) => evil(s) === evil(seats[0]))
			}));
		}
		case 'alignment':
			return pool(spec, ctx).map((s) => ({ seats: [s], yes: ctx.world.alignment(s) === 'evil' }));
		case 'direction':
			return directionOptions(ctx, match);
		case 'distance':
			return distanceOptions(spec, ctx, match);
		case 'storyteller':
			return choose(pool(spec, ctx), n).map((seats) => ({
				seats,
				...(seats.length === 1 ? { pivot: seats[0] } : {})
			}));
	}
}

/**
 * A `character` block: one player's character, or two players and the character one of them
 * is. A player registering as another type (the Recluse as a Minion) may be shown as any
 * character of that type.
 */
function characterOptions(
	spec: BlockSpec,
	ctx: BlockContext,
	match: (s: SeatId) => boolean
): InfoOption[] {
	const from = pool(spec, ctx);
	const targets = namesWho(spec) ? from.filter(match) : from;
	const options =
		spec.choose === 2
			? targets.flatMap((target) => {
					const shown = shownAs(target, ctx);
					return from
						.filter((s) => s !== target)
						.map((other): InfoOption => ({ seats: [target, other], ...shown }));
				})
			: targets.map((s): InfoOption => ({ seats: [s], ...shownAs(s, ctx) }));
	if (spec.noneWhenAbsent && targets.length === 0)
		options.push({ seats: [], none: true, number: 0 });
	return options;
}

/**
 * A `direction` block: clockwise (yes) or anticlockwise (no) to the closest player who
 * matches; either when the nearest each way are as close. Dead players' seats count.
 */
function directionOptions(
	{ game, seatId }: BlockContext,
	match: (s: SeatId) => boolean
): InfoOption[] {
	const n = game.seating.length;
	const at = game.seating.indexOf(seatId);
	const steps = (dir: 1 | -1) => {
		for (let i = 1; i < n; i++) {
			if (match(game.seating[(((at + dir * i) % n) + n) % n])) return i;
		}
		return undefined;
	};
	const clockwise = steps(1);
	const anticlockwise = steps(-1);
	if (clockwise === undefined || anticlockwise === undefined) return [];
	return [
		...(clockwise <= anticlockwise ? [{ seats: [], yes: true }] : []),
		...(anticlockwise <= clockwise ? [{ seats: [], yes: false }] : [])
	];
}

/** A `distance` block: the fewest steps from a player who matches to one of the `to` types. */
function distanceOptions(
	spec: BlockSpec,
	{ game, world }: BlockContext,
	match: (s: SeatId) => boolean
): InfoOption[] {
	const n = game.seating.length;
	const indexes = (wanted: (s: SeatId) => boolean) =>
		game.seating.flatMap((s, i) => (wanted(s) ? [i] : []));
	const from = indexes(match);
	const to = indexes((s) => {
		const type = world.type(s);
		return type !== undefined && (spec.to?.includes(type) ?? false);
	});
	if (from.length === 0 || to.length === 0) return [];
	const steps = Math.min(...from.flatMap((a) => to.map((b) => stepsBetween(a, b, n))));
	return [{ seats: [], number: steps }];
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
	// The players last shown, whose types the ones shown now must differ from.
	if (spec.differsFromToken)
		return lastShown(ctx.game, ctx.seatId, ctx.characterId, spec.differsFromToken);
	const match = matcher(spec, ctx);
	switch (spec.measure) {
		case 'alignment':
		case 'storyteller':
			return [];
		case 'character':
			return spec.choose === 2 ? pool(spec, ctx).filter(match) : [];
		case 'same':
			return pool(spec, ctx).filter((s) => ctx.world.alignment(s) === 'evil');
		case 'direction':
			return ctx.game.seating.filter((s) => s !== ctx.seatId && match(s));
		case 'distance':
			return ctx.game.seating.filter((s) => {
				const type = ctx.world.type(s);
				return match(s) || (type !== undefined && (spec.to?.includes(type) ?? false));
			});
	}
	const from = spec.scope === 'neighbour-pairs' ? ctx.game.seating : pool(spec, ctx);
	return from.filter(match);
}

/** The highest number a `count` or `distance` block can show. */
export function blockHighest(spec: BlockSpec, game: Game): number {
	if (spec.measure === 'distance') return Math.max(1, Math.floor(game.seating.length / 2));
	if (spec.scope === 'alive-neighbours') return 2;
	return spec.choose || game.seating.length;
}

/** The lowest number a number block can show: a distance is at least a step. */
export function blockLowest(spec: BlockSpec): number {
	return spec.measure === 'distance' ? 1 : 0;
}

/**
 * The highest number a `count` block could truly be, when it is lower than `blockHighest`:
 * for pairs of neighbours, the most pairs the players who match in any registration world
 * (`matchable`) can make.
 */
export function blockMostTrue(
	spec: BlockSpec,
	game: Game,
	matchable: () => number
): number | undefined {
	return spec.scope === 'neighbour-pairs' ? mostPairs(game, matchable()) : undefined;
}
