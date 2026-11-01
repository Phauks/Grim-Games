<!--
	One reminder token on a board, where it sits: by its seat, where it was put down, or under
	the finger while it is dragged. The Storyteller's board (BoardSeats, `placedLook`) and a
	player's grim (PlayerSeatReminders, `playerLook`) alike (Trevor, 2026-11-01).
-->
<script lang="ts">
	import type { Alignment, Character, ReminderLabel } from '#lib/core/data/index.ts';
	import type { GenericLook } from '#lib/core/model/index.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';

	interface Props {
		/** How it looks: `placedLook` on the board, `playerLook` on a player's grim. */
		look: Pick<GenericLook, 'symbol' | 'symbolColour' | 'symbolFill'> & {
			label: ReminderLabel;
			infinite: boolean;
			character: Character | undefined;
			/** The character whose look a copied reminder takes. */
			art?: Character;
		};
		/** Where it sits, in % of the board. */
		at: { x: number; y: number };
		alignment?: Alignment;
		size: number;
		disabled: boolean;
		/** The seat it is on (1 is the first), for tests and the held-seat dimming. */
		seatNumber?: number;
		/** Its seat is held: it stays lit while the rest of the board darkens. */
		onHeldSeat?: boolean;
		dragging?: boolean;
		/** A copy beyond what the game gives. */
		extra?: boolean;
		/** Put down on the board, belonging to no seat. */
		loose?: boolean;
		/** Loose in attached mode: it belongs to no seat until it is put on one. */
		unassigned?: boolean;
		/** One of the walked-through step's reminders. */
		now?: boolean;
		/** Only follows the finger: hidden from assistive tech. */
		ghost?: boolean;
		onTap: () => void;
		onDrag?: (x: number, y: number, end: boolean) => void;
		onCancel?: () => void;
	}

	let {
		look,
		at,
		alignment,
		size,
		disabled,
		seatNumber,
		onHeldSeat = false,
		dragging = false,
		extra = false,
		loose = false,
		unassigned = false,
		now = false,
		ghost = false,
		onTap,
		onDrag,
		onCancel
	}: Props = $props();
</script>

<div
	class="chip-slot"
	data-seat={seatNumber}
	data-loose={loose ? '' : undefined}
	class:on-held-seat={onHeldSeat}
	class:dragging
	class:extra
	data-extra={extra ? '' : undefined}
	class:unassigned
	data-unassigned={unassigned ? '' : undefined}
	class:now
	style:left="{at.x}%"
	style:top="{at.y}%"
	aria-hidden={ghost ? 'true' : undefined}
>
	<BoardReminder {...look} {alignment} {size} {disabled} {onTap} {onDrag} {onCancel} />
</div>

<style>
	.chip-slot {
		position: absolute;
		translate: -50% -50%;
		z-index: 1;
	}
	/* A copy beyond what the game gives (Trevor, 2026-10-18): dashed and faded, like the
	   reminder list's tokens that don't fit a seat. */
	.chip-slot.extra > :global(.reminder) {
		outline: 0.15rem dashed var(--on-surface);
		outline-offset: 0.15rem;
		opacity: 0.75;
	}
	/* Back in attached mode, a reminder left loose belongs to no seat (Trevor, 2026-10-18): a
	   dashed ring until it is put on a seat or back in the bank. */
	.chip-slot.unassigned > :global(.reminder) {
		outline: 0.15rem dashed var(--on-surface);
		outline-offset: 0.15rem;
	}
	/* The walked-through step's reminders already on the board: the bank's highlight, a ring,
	   glow or both (Settings > Tokens). */
	.chip-slot.now > :global(.reminder) {
		outline: var(--reminder-lit-ring, 0.2rem solid var(--accent));
		outline-offset: 0.15rem;
		filter: var(--reminder-lit-glow, none);
	}
	.chip-slot.dragging {
		z-index: 3;
		scale: 1.15;
	}
</style>
