<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import BoardReminderChip from '#lib/features/board/BoardReminderChip.svelte';
	import { boardLooks } from '#lib/features/board/board-looks.svelte.ts';
	import { avoidBoxes, toPercent, toPx } from '#lib/features/board/board-geometry.ts';
	import type { Box } from '#lib/features/board/name-placement.ts';
	import { fitReminders } from '#lib/features/board/reminder-fan.ts';
	import ReminderTethers from '#lib/features/board/ReminderTethers.svelte';
	import type { TrayGestures } from '#lib/features/board/tray-gestures.svelte.ts';
	import { placedId } from './player-tray-places.ts';
	import { playerSettings } from './player-settings.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import {
		placedKey,
		playerLook,
		reminderChip,
		remindersOn,
		type PlayerReminder,
		type PlayerReminders
	} from './player-reminders.ts';
	import type { SeatNotes } from './seat-notes.ts';

	/**
	 * The player's own reminders on their grim (Trevor, 2026-10-26), lined up in front of each
	 * seat towards the middle as on the board (reminder-fan.ts), at the board's reminder size and
	 * never under a finger's tap target, each with the board's line back to its seat (Trevor,
	 * 2026-10-29), by the player's own Reminder lines. A tap picks the token up, as on the board
	 * (Trevor, 2026-10-31: not the seat's reminders, which the seat itself opens). Goes inside
	 * the town.
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
		/**
		 * What a finger does with a token: the Storyteller bank's own gestures
		 * (tray-gestures.svelte.ts): a tap picks it up, a drag takes it to a seat, onto the tray
		 * (off it comes) or onto "+ New token" (a new ∞ token like it).
		 */
		gestures: TrayGestures;
		/** The seat whose token or reminder a finger is on, for "While held" lines. */
		held?: string;
		/** Boxes every reminder keeps clear of, in px: the controls in the top right. */
		clear?: readonly Box[];
	}

	let {
		seats,
		points,
		board,
		size,
		reminders,
		names,
		notes,
		characterOf,
		gestures,
		held = $bindable(),
		clear = []
	}: Props = $props();

	/** The token under a finger, as on the board (Trevor, 2026-11-01). */
	const drag = $derived(gestures.placedDrag);
	const pickUp = (seatId: string, reminder: PlayerReminder) =>
		gestures.hand.toggle({ kind: 'placed', reminderId: placedId(seatId, reminder), from: seatId });

	const chip = $derived(reminderChip(size, preferences.current.tokenAppearance.reminderScale));
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
			clear,
			board
		).at.map((spots) => spots.map((p) => toPercent(p, board)));
	});
</script>

<!-- Lifting a finger anywhere lets go of the seat. -->
<svelte:window onpointerup={() => (held = undefined)} onpointercancel={() => (held = undefined)} />

<ReminderTethers
	seats={seats.map((seat, i) => ({
		at: points[i],
		spots: fan[i] ?? [],
		held: held === seat.seatId
	}))}
	{board}
	{size}
	{chip}
	mode={playerSettings.current.reminderLines}
	under
/>

{#each seats as seat, i (seat.seatId)}
	{#each remindersOn(reminders, seat.seatId) as reminder, k (placedKey(reminder))}
		{@const id = placedId(seat.seatId, reminder)}
		{@const dragged = drag?.reminderId === id}
		<div class="hold" role="presentation" onpointerdown={() => (held = seat.seatId)}>
			<BoardReminderChip
				look={playerLook(reminder, characterOf)}
				at={dragged && drag ? drag.at : (fan[i]?.[k] ?? points[i] ?? { x: 50, y: 50 })}
				size={chip}
				disabled={false}
				seatNumber={i + 1}
				dragging={dragged}
				onTap={() => pickUp(seat.seatId, reminder)}
				onDrag={(x, y, end) => gestures.dragPlaced(id, seat.seatId, x, y, end)}
				onCancel={() => gestures.cancel()}
			/>
		</div>
	{/each}
{/each}

<style>
	/* Only marks the seat held for "While held" lines; the chip places itself. */
	.hold {
		display: contents;
	}
</style>
