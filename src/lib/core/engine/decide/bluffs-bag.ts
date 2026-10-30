import { defaultAlignment, type CharacterId } from '#lib/core/data/index.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import {
	isKnownReminder,
	isOnScript,
	trueCharacter,
	type FakeEvilInfo,
	type SeatId,
	type Tile
} from '#lib/core/model/index.ts';
import type { GameEvent } from '../events.ts';
import {
	BLUFFS_PER_SET,
	MAX_BLUFF_SET_NAME,
	alignmentFromCharacters,
	characterOf,
	nextPosition,
	refuse,
	seatOf,
	seatableCharacter,
	shuffled,
	tileOf,
	trulyInPlay,
	type Deciders
} from './shared.ts';

/** Bluff sets and the character bag. */
export const BLUFFS_BAG_DECIDERS: Deciders<
	| 'SetBluffs'
	| 'RemoveBluffSet'
	| 'RenameBluffSet'
	| 'SetFakeEvilInfo'
	| 'BuildBag'
	| 'ClearBag'
	| 'DrawTile'
	| 'ConfirmDraw'
	| 'CancelDraw'
> = {
	SetBluffs(game, command, ctx, warn) {
		const { set } = command;
		if (!Number.isInteger(set) || set < 0 || set > game.bluffs.length) {
			refuse('invalid-bluff-set', `bluff set must be from 0 to ${game.bluffs.length}`);
		}
		const characters = command.characterIds.map((id) => characterOf(ctx, id));
		if (characters.length > BLUFFS_PER_SET) {
			warn('too-many-bluffs', `a bluff set usually has ${BLUFFS_PER_SET} characters`);
		}
		// In play means a true character (a Drunk shown the Chef leaves the Chef free to
		// bluff: https://wiki.bloodontheclocktower.com/Drunk). Set 1 is the Lunatic's bluffs
		// while a player who believes they are the Demon (`believesType`) is in play, and may hold
		// characters in play (Trevor, 2026-10-16).
		const playing = trulyInPlay(game, ctx);
		const lunaticSet =
			set === 1 && [...playing].some((id) => rulesOf(id, ctx.characters)?.believesType === 'demon');
		const seen = new Set<CharacterId>();
		for (const character of characters) {
			if (seen.has(character.id)) warn('bluff-duplicate', `${character.name} is listed twice`);
			seen.add(character.id);
			if (!lunaticSet && playing.has(character.id)) {
				warn('bluff-in-play', `${character.name} is in play`);
			}
			if (defaultAlignment(character.type) !== 'good' || character.type === 'traveller') {
				warn('bluff-not-good', `${character.name} is not a good character`);
			}
			if (!isOnScript(game.script, character.id)) {
				warn('not-on-script', `${character.name} is not on the script`, [character.id]);
			}
		}
		return [{ type: 'BluffsSet', set, characterIds: characters.map((c) => c.id) }];
	},

	RemoveBluffSet(game, command) {
		const { set } = command;
		if (!Number.isInteger(set) || set < 0 || set >= game.bluffs.length) {
			refuse('invalid-bluff-set', `no bluff set ${set}`);
		}
		return [{ type: 'BluffSetRemoved', set }];
	},

	RenameBluffSet(game, command, ctx, warn) {
		const { set } = command;
		// The Demon's set keeps its name; the others are the Storyteller's to name.
		if (!Number.isInteger(set) || set < 1 || set >= game.bluffs.length) {
			refuse('invalid-bluff-set', `no bluff set ${set} to rename`);
		}
		const name = command.name.trim().slice(0, MAX_BLUFF_SET_NAME);
		if (name === (game.bluffNames?.[set] ?? '')) {
			warn('no-change', 'the set already has that name');
			return [];
		}
		return [{ type: 'BluffSetRenamed', set, name }];
	},

	SetFakeEvilInfo(game, command, ctx, warn) {
		const seatId = seatOf(game, command.seatId).seatId;
		const id = trueCharacter(game, seatId, ctx.characters);
		if (!id || rulesOf(id, ctx.characters)?.believesType !== 'demon') {
			warn('not-a-believer', 'this player does not believe they are the Demon');
		}
		const seats = (ids: readonly SeatId[]) => [
			...new Set(ids.map((s) => seatOf(game, s).seatId).filter((s) => s !== seatId))
		];
		const info: FakeEvilInfo = { minions: seats(command.info.minions) };
		if (command.info.decoy !== undefined) {
			const decoy = seatOf(game, command.info.decoy).seatId;
			if (decoy === seatId) refuse('same-seat', 'the decoy must be another player');
			info.decoy = decoy;
		}
		const chose = seats(command.info.decoyChose ?? []);
		if (info.decoy && chose.length) info.decoyChose = chose;
		const empty = !info.minions.length && !info.decoy;
		const before = game.fakeEvilInfo?.[seatId];
		if (empty ? !before : JSON.stringify(info) === JSON.stringify(before)) {
			warn('no-change', 'nothing changed');
			return [];
		}
		const event: GameEvent = { type: 'FakeEvilInfoSet', seatId };
		if (!empty) event.info = info;
		return [event];
	},

	BuildBag(game, command, ctx, warn) {
		// A new bag starts the draw again, so what the old draw put in the grimoire goes
		// (Trevor, 2026-10-17): the characters it dealt and the reminders of its characters.
		// Player names and seats stay.
		const cleared: GameEvent[] = [];
		if (game.bag && Object.values(game.bag.tiles).some((t) => t.drawnBySeat !== undefined)) {
			warn('bag-replaced', 'tiles had already been drawn from the old bag');
			const old = game.bag;
			const tiles = Object.values(old.tiles);
			const characters = new Set([
				...tiles.flatMap((t) => [t.grimoire, t.shows, ...t.reminders.map((r) => r.characterId)]),
				...(old.unseated ?? []).map((r) => r.characterId)
			]);
			for (const tile of tiles) {
				const seat = tile.confirmed && tile.drawnBySeat ? game.seats[tile.drawnBySeat] : undefined;
				if (seat && seat.characterId === tile.grimoire) {
					cleared.push({ type: 'CharacterCleared', seatId: seat.seatId });
				}
			}
			for (const id of game.seating) {
				for (const r of game.seats[id].reminders) {
					if (characters.has(r.characterId)) {
						cleared.push({ type: 'ReminderRemoved', reminderId: r.reminderId });
					}
				}
			}
		}
		const tiles: Tile[] = command.tiles.map((spec) => {
			const shows = seatableCharacter(ctx, spec.shows);
			const grimoire = seatableCharacter(ctx, spec.grimoire);
			if (!command.includeTravellers && grimoire.type === 'traveller') {
				warn('traveller-in-bag', `${grimoire.name} is a Traveller in a bag without Travellers`);
			}
			for (const character of [shows, grimoire]) {
				if (character.type !== 'traveller' && !isOnScript(game.script, character.id)) {
					warn('not-on-script', `${character.name} is not on the script`, [character.id]);
				}
			}
			const reminders = (spec.reminders ?? []).map((r) => {
				const source = characterOf(ctx, r.characterId);
				if (!isKnownReminder(source, r.label)) {
					warn('reminder-not-for-character', `${source.name} has no "${r.label}" reminder`);
				}
				return { characterId: r.characterId, label: r.label };
			});
			return {
				tileId: ctx.newId(),
				shows: shows.id,
				grimoire: grimoire.id,
				reminders,
				confirmed: false
			};
		});
		const unseated = (command.unseated ?? []).map((r) => {
			const source = characterOf(ctx, r.characterId);
			if (!isKnownReminder(source, r.label)) {
				warn('reminder-not-for-character', `${source.name} has no "${r.label}" reminder`);
			}
			return { characterId: r.characterId, label: r.label };
		});
		const ids = tiles.map((t) => t.tileId);
		const order = command.shuffle === false ? ids : shuffled(ids, ctx);
		return [
			...cleared,
			{
				type: 'BagBuilt',
				tiles,
				order,
				includeTravellers: command.includeTravellers,
				...(unseated.length ? { unseated } : {})
			}
		];
	},

	ClearBag(game, command, ctx, warn) {
		if (!game.bag) {
			warn('no-change', 'there is no bag');
			return [];
		}
		return [{ type: 'BagCleared' }];
	},

	DrawTile(game, command, ctx, warn) {
		const seat = seatOf(game, command.seatId);
		if (!game.bag) refuse('no-bag', 'there is no bag');
		const tileId = command.tileId ?? game.bag.order[0];
		if (tileId === undefined) refuse('bag-empty', 'the bag is empty');
		tileOf(game, tileId);
		if (!game.bag.order.includes(tileId)) refuse('tile-not-in-bag', 'that tile is not in the bag');
		const holding = Object.values(game.bag.tiles).some(
			(t) => t.drawnBySeat === seat.seatId && !t.confirmed
		);
		if (holding) warn('seat-holds-tile', 'this player is already holding a tile');
		return [{ type: 'TileDrawn', tileId, seatId: seat.seatId }];
	},

	ConfirmDraw(game, command, ctx, warn) {
		const tile = tileOf(game, command.tileId);
		if (tile.confirmed) refuse('tile-confirmed', 'that draw is already confirmed');
		if (tile.drawnBySeat === undefined) refuse('tile-not-drawn', 'nobody has drawn that tile');
		const seat = seatOf(game, tile.drawnBySeat);
		const grimoire = seatableCharacter(ctx, tile.grimoire);
		if (seat.characterId !== undefined) {
			warn('replaces-character', 'the seat already had a character');
		}
		const alignment = command.alignment ?? alignmentFromCharacters(grimoire, tile.reminders, ctx);
		return [
			{ type: 'DrawConfirmed', tileId: tile.tileId },
			{
				type: 'CharacterAssigned',
				seatId: seat.seatId,
				characterId: grimoire.id,
				...(alignment !== undefined ? { alignment } : {})
			}
			// The tile's "Is The Drunk" style reminders are not placed here: setupReminders
			// suggests them on this seat (Trevor, 2026-10-16).
		];
	},

	CancelDraw(game, command, ctx) {
		const tile = tileOf(game, command.tileId);
		if (tile.confirmed) refuse('tile-confirmed', 'that draw is already confirmed');
		if (tile.drawnBySeat === undefined) refuse('tile-not-drawn', 'nobody has drawn that tile');
		return [
			{
				type: 'DrawCancelled',
				tileId: tile.tileId,
				position: nextPosition(game.bag!.order.length, ctx)
			}
		];
	}
};
