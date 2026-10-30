import { defaultAlignment } from '#lib/core/data/index.ts';
import { isKnownReminder, seatNumber, type Tile, type TileId } from '#lib/core/model/index.ts';
import type { TileSpec } from '../commands.ts';
import type { GameEvent } from '../events.ts';
import { SEATS_DECIDERS } from './seats.ts';
import {
	characterOf,
	nextPosition,
	refuse,
	seatOf,
	seatableCharacter,
	type Deciders
} from './shared.ts';

/**
 * A late player joins mid-draw (the fair late seat, Trevor, 2026-10-30; the choice of who
 * changes is `planLateSeat` in core/rules, and the Storyteller's to change). One command,
 * so Undo takes it all back.
 */
export const LATE_PLAYER_DECIDERS: Deciders<'AddLatePlayer'> = {
	AddLatePlayer(game, command, ctx, warn) {
		if (!game.bag) refuse('no-bag', 'there is no bag');
		if (game.pastDays.length > 0) {
			warn(
				'late-player-in-play',
				'the game is under way: a late player usually joins as a Traveller'
			);
		}
		const events: GameEvent[] = SEATS_DECIDERS.AddSeat(
			game,
			{ type: 'AddSeat', playerName: command.playerName, position: command.position },
			ctx,
			warn
		);
		const tiles = Object.values(game.bag.tiles);
		let added = game.nightOrderOverrides.length;
		for (const change of command.changes) {
			const seat = seatOf(game, change.seatId);
			const character = seatableCharacter(ctx, change.characterId);
			const tile = tiles.find((t) => t.drawnBySeat === seat.seatId);
			if (tile) {
				events.push({
					type: 'TileRecast',
					tileId: tile.tileId,
					shows: character.id,
					grimoire: character.id,
					reminders: []
				});
			}
			// A held tile is confirmed later, with its new character; a seen one changes now.
			if (tile && !tile.confirmed) continue;
			if (!tile && seat.characterId === undefined) {
				warn('seat-has-character', 'this player had no character to change');
			}
			for (const r of seat.reminders) {
				if (tile?.reminders.some((t) => t.characterId === r.characterId && t.label === r.label)) {
					events.push({ type: 'ReminderRemoved', reminderId: r.reminderId });
				}
			}
			const assigned: GameEvent = {
				type: 'CharacterAssigned',
				seatId: seat.seatId,
				characterId: character.id
			};
			const alignment = defaultAlignment(character.type);
			if (alignment !== undefined) assigned.alignment = alignment;
			events.push(assigned);
			// First thing on the first night, before Minion and Demon info: a changed player
			// may now be evil.
			const who = seat.playerName || `Seat ${seatNumber(game, seat.seatId) ?? '?'}`;
			events.push({
				type: 'NightStepOverrideAdded',
				index: added++,
				override: {
					kind: 'add',
					id: `late-seat-${seat.seatId}`,
					title: 'Late seat',
					characterId: character.id,
					text: `Wake ${who}. Show the "You are" token and ${character.name}.`,
					after: 'dusk',
					night: 'first'
				}
			});
		}
		events.push(
			...refill(
				game.bag.order.map((id) => game.bag!.tiles[id]),
				command.bag
			)
		);
		return events;

		/** The tiles still in the bag become `specs`, keeping each tile that already matches. */
		function refill(inBag: Tile[], specs: readonly TileSpec[]): GameEvent[] {
			const wanted = specs.map((spec) => {
				const shows = seatableCharacter(ctx, spec.shows).id;
				const grimoire = seatableCharacter(ctx, spec.grimoire).id;
				const reminders = (spec.reminders ?? []).map((r) => {
					const source = characterOf(ctx, r.characterId);
					if (!isKnownReminder(source, r.label)) {
						warn('reminder-not-for-character', `${source.name} has no "${r.label}" reminder`);
					}
					return { characterId: r.characterId, label: r.label };
				});
				return { shows, grimoire, reminders };
			});
			const same = (t: Tile, w: (typeof wanted)[number]) =>
				t.shows === w.shows && t.grimoire === w.grimoire;
			const unmatched: Tile[] = [];
			for (const tile of inBag) {
				const i = wanted.findIndex((w) => same(tile, w));
				if (i === -1) unmatched.push(tile);
				else wanted.splice(i, 1);
			}
			const out: GameEvent[] = [];
			let length = inBag.length;
			for (const tile of unmatched) {
				const next = wanted.shift();
				if (next) {
					out.push({ type: 'TileRecast', tileId: tile.tileId, ...next });
				} else {
					out.push({ type: 'TileRemoved', tileId: tile.tileId });
					length--;
				}
			}
			for (const next of wanted) {
				const tileId: TileId = ctx.newId();
				out.push({
					type: 'TileAdded',
					tile: { tileId, ...next, confirmed: false },
					position: nextPosition(length++, ctx)
				});
			}
			return out;
		}
	}
};
