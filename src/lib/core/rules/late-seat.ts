/**
 * The fair late seat (Trevor, 2026-10-30; plan in the doc "Adding a late player mid-draw"):
 * a player arrives after some players have drawn and looked, and the game grows by one
 * seat instead of the newcomer joining as a Traveller
 * (https://wiki.bloodontheclocktower.com/Travellers).
 *
 * The setup counts change with the player count (https://wiki.bloodontheclocktower.com/Setup),
 * so the new tiles cannot simply go in the bag: they could then only reach players still
 * to draw. Instead every change is made the one way that leaves the deal exactly as random
 * as a fresh draw for the new count, by character type:
 *
 * - A type that is swapped for another (an Outsider for a Townsfolk going to 13) is taken
 *   from a tile of that type picked at random, drawn or not. If a drawn player held it,
 *   they change.
 * - The one extra tile lands on any of the seats at random, the new one included. If it
 *   lands on a drawn player of another type, they change and their old character goes
 *   back in the bag.
 *
 * Fairness is by type, because the counts are all players can reason about: which
 * character the Storyteller added stays secret. Two choices trade a little of it for less
 * leaked information: a drawn Demon never moves (an ex-Demon would know the Demon sits
 * with a later drawer), and a character sent back to the bag stays in play only as often
 * as any character of its type is (otherwise "I was the Tea Lady" says one is in play).
 * Characters that a setup modifier needs are always kept.
 *
 * This only decides what changes. Which characters are added, and what the counts are
 * with setup modifiers and the Sentinel, is the selection's job (`analyseSelection`).
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { SeatId, TileId } from '#lib/core/model/types.ts';
import { SEATED_TYPES, type SeatedType, type TypeCounts } from './distribution.ts';

/** A player who has seen their character (a confirmed draw, or a tile still held). */
export interface SeenSeat {
	seatId: SeatId;
	characterId: CharacterId;
	type: SeatedType;
}

/** A tile still in the bag. */
export interface UndrawnTile {
	tileId: TileId;
	characterId: CharacterId;
	type: SeatedType;
}

export interface LateSeatInput {
	seen: readonly SeenSeat[];
	bag: readonly UndrawnTile[];
	/** The counts for the new number of players, setup modifiers included. */
	target: Readonly<TypeCounts>;
	/** How many characters of each type the script has, for the neutral swap. */
	scriptCounts: Readonly<TypeCounts>;
	/** Characters that must stay in play: a setup modifier's, or one a modifier needs. */
	keepInPlay?: (id: CharacterId) => boolean;
	/** A drawn Demon never moves. On unless a test turns it off. */
	demonStays?: boolean;
	/** A number in [0, 1). */
	random: () => number;
}

/** A drawn player whose character changes, and to which type. */
export interface LateSeatChange {
	seatId: SeatId;
	from: CharacterId;
	fromType: SeatedType;
	toType: SeatedType;
}

export interface LateSeatPlan {
	changes: LateSeatChange[];
	/** Tiles taken out of the bag: their type has fewer characters at the new count. */
	removedTiles: TileId[];
	/** New tiles for the bag, by type; the selection picks their characters. */
	addTiles: SeatedType[];
	/** Changed players' characters that go back in the bag. */
	returned: CharacterId[];
	/**
	 * Changed players' characters that leave play (the neutral swap): an unused character
	 * of the same type goes in the bag in their place, one of `addTiles`.
	 */
	replaced: CharacterId[];
}

/** Counts by type of the seen and undrawn characters. */
export function countByType(types: readonly SeatedType[]): TypeCounts {
	const counts: TypeCounts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
	for (const type of types) counts[type]++;
	return counts;
}

interface Slot {
	seat: SeenSeat;
	/** The type the seat ends up with. */
	type: SeatedType;
}

interface PoolTile {
	type: SeatedType;
	/** A tile already in the bag, a new one, or a changed player's own going back. */
	kind: 'bag' | 'new' | 'returned';
}

function pickIndex(length: number, random: () => number): number {
	return Math.min(length - 1, Math.floor(random() * length));
}

/**
 * What changes when one or more players join: which drawn players change type, which bag
 * tiles go and which come in. Throws unless the target is for more players than now.
 * Several late players are the one-player step done once for each, so each stays fair.
 */
export function planLateSeat(input: LateSeatInput): LateSeatPlan {
	const { random } = input;
	const keep = input.keepInPlay ?? (() => false);
	const demonStays = input.demonStays ?? true;
	const current = countByType([...input.seen, ...input.bag].map((c) => c.type));
	const players = SEATED_TYPES.reduce((sum, t) => sum + current[t], 0);
	const wanted = SEATED_TYPES.reduce((sum, t) => sum + input.target[t], 0);
	if (wanted <= players) {
		throw new RangeError(`The new counts are for ${wanted} players, not more than ${players}.`);
	}

	// Fixed by the counts alone, never by who drew what, so each step stays exact.
	const removed: SeatedType[] = [];
	const added: SeatedType[] = [];
	for (const type of SEATED_TYPES) {
		const diff = input.target[type] - current[type];
		for (let i = 0; i < -diff; i++) removed.push(type);
		for (let i = 0; i < diff; i++) added.push(type);
	}
	// Each extra tile is a Townsfolk while one is added: it is the commonest type, so it most
	// often lands on a player of its own type and changes nobody.
	const inserted: SeatedType[] = [];
	for (let i = players; i < wanted; i++) {
		const at = added.includes('townsfolk') ? added.indexOf('townsfolk') : 0;
		inserted.push(...added.splice(at, 1));
	}

	const slots: Slot[] = input.seen.map((seat) => ({ seat, type: seat.type }));
	const pool: PoolTile[] = input.bag.map((t) => ({ type: t.type, kind: 'bag' }));
	const removedTiles: TileId[] = [];
	const returned: CharacterId[] = [];
	const replaced: CharacterId[] = [];

	// Swap one tile of a type for another: any tile of that type, drawn or not, at random.
	removed.forEach((from, i) => {
		const to = added[i];
		const isCandidate = (slot: Slot) =>
			slot.type === from && !(slot.type === slot.seat.type && keep(slot.seat.characterId));
		const seatChoices = slots.filter(isCandidate);
		const poolChoices = pool.filter((t) => t.type === from);
		const n = seatChoices.length + poolChoices.length;
		if (n === 0) return;
		const j = pickIndex(n, random);
		if (j < seatChoices.length) {
			seatChoices[j].type = to;
			return;
		}
		const tile = poolChoices[j - seatChoices.length];
		if (tile.kind === 'bag') removedTiles.push(input.bag[pool.indexOf(tile)].tileId);
		tile.kind = 'new';
		tile.type = to;
	});

	// Each extra tile lands on any seat at random: a drawn one, or one of the undrawn (the
	// bag's tiles, which hold the earlier late players' own, and this late player's seat).
	const open = slots.filter((s) => !(demonStays && s.seat.type === 'demon'));
	for (const type of inserted) insert(type);

	function insert(inserted: SeatedType) {
		const j = pickIndex(open.length + pool.length + 1, random);
		const hit = open[j];
		if (!hit || hit.type === inserted) {
			pool.push({ type: inserted, kind: 'new' });
			return;
		}
		const oldType = hit.type;
		hit.type = inserted;
		if (oldType !== hit.seat.type) {
			// Changed by an earlier step, so the character it held was a new one anyway.
			pool.push({ type: oldType, kind: 'new' });
			return;
		}
		// Back in the bag, kept only as often as any character of its type is in play.
		const id = hit.seat.characterId;
		const chance = Math.min(1, input.target[oldType] / Math.max(1, input.scriptCounts[oldType]));
		if (keep(id) || random() < chance) {
			returned.push(id);
			pool.push({ type: oldType, kind: 'returned' });
		} else {
			replaced.push(id);
			pool.push({ type: oldType, kind: 'new' });
		}
	}

	const changes = slots
		.filter((s) => s.type !== s.seat.type)
		.map((s) => ({
			seatId: s.seat.seatId,
			from: s.seat.characterId,
			fromType: s.seat.type,
			toType: s.type
		}));
	const addTiles = pool.filter((t) => t.kind === 'new').map((t) => t.type);
	return { changes, removedTiles, addTiles, returned, replaced };
}
