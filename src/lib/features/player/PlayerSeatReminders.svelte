<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { avoidBoxes, toPercent, toPx } from '#lib/features/grimoire/board-geometry.ts';
	import type { Box } from '#lib/features/grimoire/name-placement.ts';
	import { fitReminders } from '#lib/features/grimoire/reminder-fan.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import { placedKey, remindersOn, type PlayerReminders } from './player-reminders.ts';
	import type { SeatNotes } from './seat-notes.ts';

	/**
	 * The player's own reminders on their grim (Trevor, 2026-10-26), lined up in front of each
	 * seat towards the middle as on the board (reminder-fan.ts), at the board's reminder size and
	 * never under a finger's tap target. A tap opens the seat's reminders. Goes inside the town.
	 */
	interface Props {
		seats: readonly PublicSeat[];
		/** Each seat's centre, in % of the town. */
		points: readonly SeatPoint[];
		board: { width: number; height: number };
		/** Token diameter in px. */
		size: number;
		reminders: PlayerReminders;
		/** Each seat's name box, which its reminders keep clear of. */
		names: readonly { box: Box }[];
		/** Seats with the player's note mark. */
		notes: Readonly<SeatNotes>;
		characterOf: (id: CharacterId) => Character | undefined;
		onOpen: (seat: PublicSeat) => void;
	}

	let { seats, points, board, size, reminders, names, notes, characterOf, onOpen }: Props =
		$props();

	const chip = $derived(
		Math.max(
			44,
			Math.round(
				Math.max(30, Math.min(48, size * 0.5)) * preferences.current.tokenAppearance.reminderScale
			)
		)
	);
	const fan = $derived.by(() => {
		if (board.width <= 0 || board.height <= 0) return seats.map(() => []);
		return fitReminders(
			seats.map((seat, i) => ({
				seat: toPx(points[i], board),
				middle: { x: board.width / 2, y: board.height / 2 },
				count: remindersOn(reminders, seat.seatId).length,
				size,
				chip,
				avoid: avoidBoxes({
					centre: toPx(points[i], board),
					size,
					// Every seat's name is a badge on its rim (SeatDisc).
					hasFace: true,
					name: names[i]?.box,
					dead: seat.dead,
					note: !!notes[seat.seatId],
					nameOffset: boardLooks.current.nameOffset
				})
			})),
			[],
			board
		).at.map((spots) => spots.map((p) => toPercent(p, board)));
	});
</script>

{#each seats as seat, i (seat.seatId)}
	{#each remindersOn(reminders, seat.seatId) as reminder, k (placedKey(reminder))}
		{@const p = fan[i]?.[k] ?? points[i]}
		<div class="chip-slot" style:left="{p?.x ?? 50}%" style:top="{p?.y ?? 50}%">
			<BoardReminder
				label={reminder.label}
				character={characterOf(reminder.characterId)}
				size={chip}
				onTap={() => onOpen(seat)}
			/>
		</div>
	{/each}
{/each}

<style>
	.chip-slot {
		position: absolute;
		translate: -50% -50%;
		z-index: 1;
	}
</style>
