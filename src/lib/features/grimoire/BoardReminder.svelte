<script lang="ts">
	import type { Alignment, Character, ReminderLabel } from '#lib/core/data/index.ts';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';

	/**
	 * A reminder token on the board, as in the physical grimoire: a round parchment token
	 * with its character's icon and its words. Tap opens the seat; drag moves it to another
	 * seat (the parent decides where it lands).
	 */
	interface Props {
		label: ReminderLabel;
		character: Character | undefined;
		/** Diameter in px. */
		size: number;
		/**
		 * Alignment of the player whose character put the token down: the icon is drawn in
		 * its colour, so a turned-evil good player's reminders are red (Trevor, 2026-10-16).
		 */
		alignment?: Alignment;
		/** "+3" style overflow marker instead of a token. */
		more?: number;
		disabled?: boolean;
		onTap: () => void;
		/** Pointer position in client px while dragging; `end` true when released. */
		onDrag?: (x: number, y: number, end: boolean) => void;
		onCancel?: () => void;
	}

	let {
		label,
		character,
		size,
		alignment,
		more,
		disabled = false,
		onTap,
		onDrag,
		onCancel
	}: Props = $props();

	const src = $derived(character ? iconUrl(character, alignment) : undefined);

	/** Pointer movement, in px, before a press becomes a drag. */
	const SLOP = 8;
	let down: { x: number; y: number; id: number } | null = null;
	let dragging = false;

	function pointerdown(event: PointerEvent) {
		if (disabled) return;
		down = { x: event.clientX, y: event.clientY, id: event.pointerId };
		dragging = false;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	function pointermove(event: PointerEvent) {
		if (!down || event.pointerId !== down.id || !onDrag) return;
		if (!dragging && Math.hypot(event.clientX - down.x, event.clientY - down.y) < SLOP) return;
		dragging = true;
		onDrag(event.clientX, event.clientY, false);
	}
	function pointerup(event: PointerEvent) {
		if (!down || event.pointerId !== down.id) return;
		if (dragging) onDrag?.(event.clientX, event.clientY, true);
		else onTap();
		down = null;
		dragging = false;
	}
	function pointercancel() {
		if (dragging) onCancel?.();
		down = null;
		dragging = false;
	}
</script>

<button
	type="button"
	class="reminder"
	data-type={character?.type}
	data-testid="board-reminder"
	style:--d="{size}px"
	aria-label={more ? `${more} more reminders` : `${label} reminder`}
	{disabled}
	onpointerdown={pointerdown}
	onpointermove={pointermove}
	onpointerup={pointerup}
	onpointercancel={pointercancel}
	onclick={(event) => event.detail === 0 && onTap()}
>
	{#if more}
		<span class="more">+{more}</span>
	{:else}
		{#if src}<img {src} alt="" draggable="false" />{/if}
		<!-- eslint-disable-next-line grim/names-as-badges -- this is the reminder token on the board -->
		<span class="label">{label}</span>
	{/if}
</button>

<style>
	.reminder {
		--rim: var(--reminder-face);
		position: relative;
		display: grid;
		place-items: center;
		width: var(--d);
		height: var(--d);
		padding: 0;
		border: 2px solid var(--rim);
		border-radius: 50%;
		background: var(--reminder-face);
		box-shadow: var(--shadow);
		color: var(--on-reminder);
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.reminder:disabled {
		cursor: default;
	}
	.reminder[data-type='townsfolk'],
	.reminder[data-type='outsider'] {
		--rim: var(--good);
	}
	.reminder[data-type='minion'],
	.reminder[data-type='demon'] {
		--rim: var(--evil);
	}
	.reminder[data-type='traveller'] {
		--rim: var(--traveller);
	}
	.reminder[data-type='fabled'] {
		--rim: var(--fabled);
	}
	.reminder[data-type='loric'] {
		--rim: var(--loric);
	}
	img {
		width: 84%;
		height: 84%;
		margin-top: -16%;
		object-fit: contain;
		pointer-events: none;
	}
	/* The words sit across the bottom of the token, on a band so they stay legible. */
	.label {
		position: absolute;
		left: 50%;
		bottom: calc(-0.125 * var(--u));
		translate: -50% 0;
		max-width: calc(var(--d) * 1.5);
		padding: 0 0.3em;
		overflow: hidden;
		border-radius: var(--radius-sm);
		background: var(--reminder-face);
		box-shadow: 0 0 0 1.5px var(--rim);
		font-family: var(--font-character);
		font-size: calc(0.6rem * var(--reminder-scale, 1));
		font-variant: small-caps;
		line-height: 1.35;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.more {
		font: 600 0.85rem / 1 var(--font-control);
	}
</style>
