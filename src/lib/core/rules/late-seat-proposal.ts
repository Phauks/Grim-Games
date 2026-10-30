/**
 * The Add late player sheet's starting point (Trevor, 2026-10-30): the counts for one more
 * player, and a fair roll of who changes (`planLateSeat`) with characters picked for every
 * new tile. It only suggests; the Storyteller changes, keeps or adds anyone before
 * confirming, and the counts check warns rather than blocks.
 */
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { analyseSelection } from './bag-plan.ts';
import { isBagDisabled, isNotDealt, isReplacedAfterDraw } from './bag-characters.ts';
import { SEATED_TYPES, type SeatedType, type TypeCounts } from './distribution.ts';
import { countByType, planLateSeat, type SeenSeat, type UndrawnTile } from './late-seat.ts';

export interface LateSeatProposalInput {
	game: Game;
	/** The script's characters, in script order. */
	scriptCharacters: readonly Character[];
	lookup: (id: CharacterId) => Character | undefined;
	/** Fabled and Loric in play, with the Sentinel when the Storyteller invokes it. */
	ruleCharacters: readonly CharacterId[];
	random: () => number;
}

export interface LateSeatChoice {
	seatId: SeatId;
	from: CharacterId;
	to: CharacterId;
}

export interface LateSeatProposal {
	/** Character counts now, and for one more player. */
	before: TypeCounts;
	after: TypeCounts;
	/** The same for one more player, by what the tiles are (a Drunk's tile is a Townsfolk). */
	tileTarget: TypeCounts;
	changes: LateSeatChoice[];
	/** What the tiles still in the bag become, by grimoire character. */
	bag: CharacterId[];
	/** Characters the roll took out of play. */
	outOfPlay: CharacterId[];
}

const isSeated = (type: string): type is SeatedType =>
	(SEATED_TYPES as readonly string[]).includes(type);

/** The drawn players, the tiles still in the bag, and every character in play. */
export function drawState(game: Game, lookup: (id: CharacterId) => Character | undefined) {
	const tiles = Object.values(game.bag?.tiles ?? {});
	const typeOf = (id: CharacterId): SeatedType => {
		const type = lookup(id)?.type;
		return type && isSeated(type) ? type : 'townsfolk';
	};
	const seen: SeenSeat[] = tiles
		.filter((t) => t.drawnBySeat !== undefined)
		.map((t) => ({ seatId: t.drawnBySeat!, characterId: t.grimoire, type: typeOf(t.grimoire) }));
	const bag: UndrawnTile[] = (game.bag?.order ?? []).map((id) => {
		const t = game.bag!.tiles[id];
		return { tileId: id, characterId: t.grimoire, type: typeOf(t.grimoire) };
	});
	const unseated = (game.bag?.unseated ?? []).map((r) => r.characterId);
	const inPlay = [...tiles.map((t) => t.grimoire), ...unseated];
	return { seen, bag, unseated, inPlay, typeOf };
}

/**
 * The combination of the allowed counts that adds up to `total` and changes least from
 * `before`, ties picked at random. A setup rule's choice (the Sentinel's Outsider, the
 * Godfather's) is the Storyteller's, so it goes the way that changes fewest players; the
 * current counts are no secret, so this gives nothing away.
 */
function pickCounts(
	expected: Record<SeatedType, number[]>,
	total: number,
	before: TypeCounts,
	random: () => number
): TypeCounts | undefined {
	let best: TypeCounts[] = [];
	let bestDistance = Infinity;
	for (const townsfolk of expected.townsfolk)
		for (const outsider of expected.outsider)
			for (const minion of expected.minion)
				for (const demon of expected.demon) {
					const counts = { townsfolk, outsider, minion, demon };
					if (townsfolk + outsider + minion + demon !== total) continue;
					const distance = SEATED_TYPES.reduce((n, t) => n + Math.abs(counts[t] - before[t]), 0);
					if (distance < bestDistance) [best, bestDistance] = [[], distance];
					if (distance === bestDistance) best.push(counts);
				}
	return best.length ? best[Math.floor(random() * best.length)] : undefined;
}

export function proposeLateSeat(input: LateSeatProposalInput): LateSeatProposal {
	const { game, lookup, random } = input;
	const { seen, bag, unseated, inPlay, typeOf } = drawState(game, lookup);
	const scriptOrder = input.scriptCharacters.map((c) => c.id);
	const selection: Record<CharacterId, number> = {};
	for (const id of inPlay) selection[id] = (selection[id] ?? 0) + 1;
	const dealt = seen.length + bag.length;
	const analysis = (players: number) =>
		analyseSelection({
			players,
			selection,
			ruleCharacters: input.ruleCharacters,
			scriptOrder,
			lookup
		});
	const before = countByType(inPlay.map(typeOf));
	const next = analysis(dealt + 1);
	const after = pickCounts(next.expected, dealt + 1, before, random) ?? { ...next.base };

	// A Drunk or Marionette has no tile: a good character's tile stands in for theirs.
	const tileTarget = { ...after };
	for (const id of unseated) {
		tileTarget[typeOf(id)]--;
		tileTarget.townsfolk++;
	}

	const characters = new Map(input.scriptCharacters.map((c) => [c.id, c]));
	const needed = new Set(
		inPlay.map((id) => rulesOf(id, characters)?.setupModifier?.requires).filter(Boolean)
	);
	const keepInPlay = (id: CharacterId) =>
		!!rulesOf(id, characters)?.setupModifier || needed.has(id);
	const scriptCounts = countByType(
		input.scriptCharacters.filter((c) => isSeated(c.type)).map((c) => c.type as SeatedType)
	);
	const plan = planLateSeat({ seen, bag, target: tileTarget, scriptCounts, keepInPlay, random });

	// New characters: unused ones from the script, picked at random. Characters that change
	// the setup (Baron, Huntsman) or have no tile of their own are left to the Storyteller.
	const used = new Set(inPlay);
	const removed = new Set(plan.removedTiles);
	const freed = [
		...bag.filter((t) => removed.has(t.tileId)).map((t) => t.characterId),
		...plan.changes.map((c) => c.from).filter((id) => !plan.returned.includes(id))
	];
	const pickNew = (type: SeatedType): CharacterId | undefined => {
		const pool = input.scriptCharacters.filter(
			(c) =>
				c.type === type &&
				!used.has(c.id) &&
				!isBagDisabled(c) &&
				!isNotDealt(c) &&
				!isReplacedAfterDraw(c) &&
				!rulesOf(c.id, characters)?.setupModifier &&
				rulesOf(c.id, characters)?.believesType === undefined
		);
		if (pool.length) {
			const id = pool[Math.floor(random() * pool.length)].id;
			used.add(id);
			return id;
		}
		// A short script runs out: a character this roll took out of play goes back in.
		const i = freed.findIndex((id) => typeOf(id) === type);
		return i === -1 ? undefined : freed.splice(i, 1)[0];
	};

	const changes: LateSeatChoice[] = [];
	for (const change of plan.changes) {
		const to = pickNew(change.toType);
		if (to) changes.push({ seatId: change.seatId, from: change.from, to });
	}
	const nextBag = [
		...bag.filter((t) => !removed.has(t.tileId)).map((t) => t.characterId),
		...plan.returned,
		...plan.addTiles.map(pickNew).filter((id): id is CharacterId => id !== undefined)
	];
	return { before, after, tileTarget, changes, bag: nextBag, outOfPlay: freed };
}

/** Tile counts once the Storyteller's choices are made, to check against `tileTarget`. */
export function lateSeatCounts(
	game: Game,
	lookup: (id: CharacterId) => Character | undefined,
	changes: readonly { seatId: SeatId; to: CharacterId }[],
	bag: readonly CharacterId[]
): TypeCounts {
	const { seen, typeOf } = drawState(game, lookup);
	const to = new Map(changes.map((c) => [c.seatId, c.to]));
	return countByType([
		...seen.map((s) => typeOf(to.get(s.seatId) ?? s.characterId)),
		...bag.map(typeOf)
	]);
}
