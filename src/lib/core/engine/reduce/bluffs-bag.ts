/**
 * The reducers for Demon bluffs, fake evil info, and the bag of character tiles, one for each
 * event type (`reducer.ts` looks them up).
 */
import { omit, type Reducers } from '#lib/core/engine/reduce/shared.ts';

export const BLUFFS_BAG_REDUCERS: Reducers<
	| 'BluffsSet'
	| 'BluffSetRemoved'
	| 'FakeEvilInfoSet'
	| 'BluffSetRenamed'
	| 'BagBuilt'
	| 'BagCleared'
	| 'TileDrawn'
	| 'DrawConfirmed'
	| 'TileRecast'
	| 'TileAdded'
	| 'TileRemoved'
	| 'DrawCancelled'
> = {
	BluffsSet(game, event) {
		const bluffs = game.bluffs.map((set) => [...set]);
		if (event.set < 0 || event.set > bluffs.length) return game;
		bluffs[event.set] = [...event.characterIds];
		return { ...game, bluffs };
	},
	BluffSetRemoved(game, event) {
		const bluffs = game.bluffs.filter((_, i) => i !== event.set);
		// Names stay with their sets as the later ones move up.
		return { ...game, bluffs, bluffNames: game.bluffNames.filter((_, i) => i !== event.set) };
	},
	FakeEvilInfoSet(game, event) {
		const fakeEvilInfo = { ...game.fakeEvilInfo };
		if (event.info) fakeEvilInfo[event.seatId] = event.info;
		else delete fakeEvilInfo[event.seatId];
		return { ...game, fakeEvilInfo };
	},
	BluffSetRenamed(game, event) {
		if (event.set < 0 || event.set >= game.bluffs.length) return game;
		const bluffNames = Array.from(
			{ length: Math.max(game.bluffNames.length ?? 0, event.set + 1) },
			(_, i) => game.bluffNames[i] ?? ''
		);
		bluffNames[event.set] = event.name;
		return { ...game, bluffNames };
	},
	BagBuilt(game, event) {
		return {
			...game,
			bag: {
				tiles: Object.fromEntries(event.tiles.map((t) => [t.tileId, structuredClone(t)])),
				order: [...event.order],
				includeTravellers: event.includeTravellers,
				...(event.unseated?.length ? { unseated: structuredClone(event.unseated) } : {})
			}
		};
	},
	BagCleared(game) {
		return omit(game, 'bag');
	},
	TileDrawn(game, event) {
		const bag = game.bag;
		if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
		return {
			...game,
			bag: {
				...bag,
				tiles: {
					...bag.tiles,
					[event.tileId]: { ...bag.tiles[event.tileId], drawnBySeat: event.seatId }
				},
				order: bag.order.filter((id) => id !== event.tileId)
			}
		};
	},
	DrawConfirmed(game, event) {
		const bag = game.bag;
		if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
		return {
			...game,
			bag: {
				...bag,
				tiles: { ...bag.tiles, [event.tileId]: { ...bag.tiles[event.tileId], confirmed: true } }
			}
		};
	},
	TileRecast(game, event) {
		const bag = game.bag;
		if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
		const tile = {
			...bag.tiles[event.tileId],
			shows: event.shows,
			grimoire: event.grimoire,
			reminders: structuredClone(event.reminders)
		};
		return { ...game, bag: { ...bag, tiles: { ...bag.tiles, [event.tileId]: tile } } };
	},
	TileAdded(game, event) {
		const bag = game.bag;
		if (!bag || Object.hasOwn(bag.tiles, event.tile.tileId)) return game;
		const order = [...bag.order];
		order.splice(Math.max(0, Math.min(event.position, order.length)), 0, event.tile.tileId);
		return {
			...game,
			bag: {
				...bag,
				tiles: { ...bag.tiles, [event.tile.tileId]: structuredClone(event.tile) },
				order
			}
		};
	},
	TileRemoved(game, event) {
		const bag = game.bag;
		if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
		return {
			...game,
			bag: {
				...bag,
				tiles: omit(bag.tiles, event.tileId),
				order: bag.order.filter((id) => id !== event.tileId)
			}
		};
	},
	DrawCancelled(game, event) {
		const bag = game.bag;
		if (!bag || !Object.hasOwn(bag.tiles, event.tileId)) return game;
		const tile = omit(bag.tiles[event.tileId], 'drawnBySeat');
		const order = bag.order.filter((id) => id !== event.tileId);
		order.splice(Math.max(0, Math.min(event.position, order.length)), 0, event.tileId);
		return {
			...game,
			bag: {
				...bag,
				tiles: { ...bag.tiles, [event.tileId]: { ...tile, confirmed: false } },
				order
			}
		};
	}
};
