<script lang="ts">
	/**
	 * A sheet's handle bar (Trevor, 2026-10-30: "a drag up with a handle bar", not a caret), drawn
	 * as BottomSheet's grabber. Drag it to pull what it sits on up or down; a tap, Enter or Space
	 * toggles it. `onPull` gets how far the pointer has moved up, in px (down is negative), and
	 * `end` once it is let go; a press that hardly moves is a tap (a click) instead.
	 */
	interface Props {
		label: string;
		expanded: boolean;
		onToggle: () => void;
		onPull?: (up: number, end: boolean) => void;
	}

	let { label, expanded, onToggle, onPull }: Props = $props();

	/** Moves under this many px are a tap, as BoardReminder counts them. */
	const SLOP = 6;
	let from = $state<{ id: number; y: number; moved: boolean }>();
	/** The click that follows a pull is not a tap. */
	let pulled = false;

	function down(event: PointerEvent) {
		if (event.button !== 0) return;
		from = { id: event.pointerId, y: event.clientY, moved: false };
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
	}
	function move(event: PointerEvent) {
		if (!from || event.pointerId !== from.id) return;
		const up = from.y - event.clientY;
		if (!from.moved && Math.abs(up) < SLOP) return;
		from.moved = true;
		onPull?.(up, false);
	}
	function up(event: PointerEvent) {
		if (!from || event.pointerId !== from.id) return;
		pulled = from.moved;
		if (from.moved) onPull?.(from.y - event.clientY, true);
		from = undefined;
	}
	function cancel() {
		if (from?.moved) onPull?.(0, true);
		from = undefined;
	}
</script>

<button
	type="button"
	class="handle"
	aria-label={label}
	aria-expanded={expanded}
	data-bin-opener
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={cancel}
	onclick={() => {
		if (!pulled) onToggle();
		pulled = false;
	}}><span class="bar" aria-hidden="true"></span></button
>

<style>
	.handle {
		display: grid;
		place-items: center;
		width: calc(5 * var(--u));
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		cursor: grab;
		/* The handle moves the sheet, not the page. */
		touch-action: none;
	}
	/* BottomSheet's grabber indicator. */
	.bar {
		width: calc(2.75 * var(--u));
		height: calc(0.3 * var(--u));
		border-radius: var(--radius-full);
		background: var(--sheet-grabber);
		opacity: 0.6;
	}
	.handle:focus-visible .bar {
		opacity: 1;
	}
</style>
