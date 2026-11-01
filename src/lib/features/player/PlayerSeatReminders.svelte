<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import BoardReminderChip from '#lib/features/grimoire/BoardReminderChip.svelte';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { avoidBoxes, toPercent, toPx } from '#lib/features/grimoire/board-geometry.ts';
	import type { Box } from '#lib/features/grimoire/name-placement.ts';
	import { fitReminders } from '#lib/features/grimoire/reminder-fan.ts';
	import ReminderTethers from '#lib/features/grimoire/ReminderTethers.svelte';
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
		/** A token tapped: picked up (PlayerReminderBin). */
		onTap: (seat: PublicSeat, reminder: PlayerReminder) => void;
		/** The town, for where a dragged token is. */
		town: HTMLElement | undefined;
		/** A token dragged and let go at a client point (PlayerReminderBin `dropPlaced`). */
		onDrop: (seat: PublicSeat, reminder: PlayerReminder, x: number, y: number) => void;
		/** The seat whose token or reminder a finger is on, for "While held" lines. */
		held?: string;
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
		onTap,
		onDrop,
		town,
		held = $bindable()
	}: Props = $props();

	/** The token under a finger, as on the board (Trevor, 2026-11-01): where it is, in %. */
	let drag = $state<{ key: string; at: SeatPoint }>();
	function dragTo(seat: PublicSeat, reminder: PlayerReminder, x: number, y: number, end: boolean) {
		const rect = town?.getBoundingClientRect();
		if (!end && rect) {
			const at = {
				x: ((x - rect.left) / rect.width) * 100,
				y: ((y - rect.top) / rect.height) * 100
			};
			drag = { key: `${seat.seatId}/${placedKey(reminder)}`, at };
			return;
		}
		drag = undefined;
		if (end) onDrop(seat, reminder, x, y);
	}

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
			[],
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
		{@const key = `${seat.seatId}/${placedKey(reminder)}`}
		{@const dragged = drag?.key === key}
		<div class="hold" role="presentation" onpointerdown={() => (held = seat.seatId)}>
			<BoardReminderChip
				look={playerLook(reminder, characterOf)}
				at={dragged && drag ? drag.at : (fan[i]?.[k] ?? points[i] ?? { x: 50, y: 50 })}
				size={chip}
				disabled={false}
				seatNumber={i + 1}
				dragging={dragged}
				onTap={() => onTap(seat, reminder)}
				onDrag={(x, y, end) => dragTo(seat, reminder, x, y, end)}
				onCancel={() => (drag = undefined)}
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
