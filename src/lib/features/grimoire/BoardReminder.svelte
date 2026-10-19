<script lang="ts">
	import type { Alignment, Character, ReminderLabel } from '#lib/core/data/index.ts';
	import { iconUrl } from '#lib/features/characters/icon-url.ts';
	import { swallowNextClick } from '#lib/ui/tap.ts';

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
		/** The generic reminder: ∞ in place of an icon, `label` its optional text. */
		infinite?: boolean;
		disabled?: boolean;
		onTap: () => void;
		/** Pointer position in client px while dragging; `end` true when released. */
		onDrag?: (x: number, y: number, end: boolean) => void;
		onCancel?: () => void;
		/**
		 * In a row that scrolls sideways (the reminder bank): a quick, nearly level move scrolls
		 * the row (Trevor, 2026-10-17); a steeper one, or one after a short hold, picks the
		 * token up (Trevor, 2026-10-19).
		 */
		panX?: boolean;
	}

	let {
		label,
		character,
		size,
		alignment,
		more,
		infinite = false,
		disabled = false,
		onTap,
		onDrag,
		onCancel,
		panX = false
	}: Props = $props();

	const src = $derived(character ? iconUrl(character, alignment) : undefined);

	/** Pointer movement, in px, before a press becomes a drag. */
	const SLOP = 8;
	/**
	 * In a row that scrolls (panX), only a move this close to level scrolls the row; anything
	 * steeper picks the token up (Trevor, 2026-10-19: drags under 45 degrees used to scroll).
	 */
	const LEVEL = Math.tan((20 * Math.PI) / 180);
	/** A press held this long, in ms, picks the token up whichever way it then moves. */
	const HOLD = 250;
	let down: {
		x: number;
		y: number;
		id: number;
		at: number;
		row?: HTMLElement;
		scroll: number;
	} | null = null;
	let dragging = false;
	/** The finger is scrolling the row instead (panX), since the browser no longer does. */
	let scrolling = false;
	let speed = 0;
	let last = { x: 0, at: 0 };
	let glide = 0;

	/** The nearest ancestor that scrolls sideways, if it has anything to scroll. */
	function rowOf(node: HTMLElement): HTMLElement | undefined {
		for (let el = node.parentElement; el; el = el.parentElement) {
			if (el.scrollWidth > el.clientWidth && /auto|scroll/.test(getComputedStyle(el).overflowX))
				return el;
		}
		return undefined;
	}

	function pointerdown(event: PointerEvent) {
		if (disabled) return;
		cancelAnimationFrame(glide);
		const node = event.currentTarget as HTMLElement;
		const row = panX ? rowOf(node) : undefined;
		down = {
			x: event.clientX,
			y: event.clientY,
			id: event.pointerId,
			at: event.timeStamp,
			row,
			scroll: row?.scrollLeft ?? 0
		};
		dragging = false;
		scrolling = false;
		node.setPointerCapture(event.pointerId);
	}
	function pointermove(event: PointerEvent) {
		if (!down || event.pointerId !== down.id || !onDrag) return;
		const dx = event.clientX - down.x;
		const dy = event.clientY - down.y;
		if (scrolling && down.row) {
			down.row.scrollLeft = down.scroll - dx;
			const dt = event.timeStamp - last.at;
			if (dt > 0) speed = (event.clientX - last.x) / dt;
			last = { x: event.clientX, at: event.timeStamp };
			return;
		}
		if (!dragging && Math.hypot(dx, dy) < SLOP) return;
		// A quick, nearly level move along a row that scrolls scrolls it; held first, or any
		// steeper, it is a drag. The row's touch-action is none, so the browser never takes
		// the press away mid-drag.
		if (
			!dragging &&
			down.row &&
			event.pointerType !== 'mouse' &&
			event.timeStamp - down.at < HOLD &&
			Math.abs(dy) <= Math.abs(dx) * LEVEL
		) {
			scrolling = true;
			last = { x: event.clientX, at: event.timeStamp };
			down.row.scrollLeft = down.scroll - dx;
			return;
		}
		dragging = true;
		onDrag(event.clientX, event.clientY, false);
	}
	/** After a flick, the row keeps moving and slows to a stop. */
	function coast(row: HTMLElement) {
		let v = speed * 16;
		const step = () => {
			if (Math.abs(v) < 0.5) return;
			row.scrollLeft -= v;
			v *= 0.94;
			glide = requestAnimationFrame(step);
		};
		glide = requestAnimationFrame(step);
	}
	function pointerup(event: PointerEvent) {
		if (!down || event.pointerId !== down.id) return;
		if (scrolling) {
			swallowNextClick(event.currentTarget);
			if (down.row && event.timeStamp - last.at < 100) coast(down.row);
		} else if (dragging) onDrag?.(event.clientX, event.clientY, true);
		else {
			swallowNextClick(event.currentTarget);
			onTap();
		}
		down = null;
		dragging = false;
		scrolling = false;
	}
	function pointercancel() {
		if (dragging) onCancel?.();
		down = null;
		dragging = false;
		scrolling = false;
	}
</script>

<button
	type="button"
	class="reminder"
	data-type={character?.type}
	data-testid="board-reminder"
	data-pan={panX ? 'x' : undefined}
	style:--d="{size}px"
	aria-label={more
		? `${more} more reminders`
		: infinite
			? `Generic reminder${label ? `: ${label}` : ''}`
			: `${label} reminder`}
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
		{#if infinite}<span class="infinite" aria-hidden="true">∞</span>{:else if src}<img
				{src}
				alt=""
				draggable="false"
			/>{/if}
		<!-- eslint-disable-next-line grim/names-as-badges -- this is the reminder token on the board -->
		{#if label}<span class="label">{label}</span>{/if}
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
		/* Always a circle at its own size, even below the tap target (Trevor, 2026-10-17: small
		   reminders became ovals); the ::after below keeps the 44px target. */
		min-width: 0;
		min-height: 0;
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
	/* An invisible tap area of at least the tap target, centred on the token. */
	.reminder::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: max(100%, var(--tap-target));
		height: max(100%, var(--tap-target));
		translate: -50% -50%;
		border-radius: 50%;
	}
	.reminder[data-pan='x'] {
		/* The token scrolls its row itself (pointermove), so a drag at any angle stays a drag. */
		touch-action: none;
	}
	.reminder:disabled {
		cursor: default;
	}
	/* A reminder of no character (the generic one) still has a rim round its token and words,
	   in the token border colour (Trevor, 2026-10-19). */
	.reminder:not([data-type]) {
		--rim: var(--token-face-shade, var(--border));
	}
	.reminder[data-type='townsfolk'],
	.reminder[data-type='outsider'] {
		--rim: var(--good);
	}
	.reminder[data-type='minion'],
	.reminder[data-type='demon'] {
		--rim: var(--evil);
	}
	/* A Traveller's reminder: half good blue, half evil red, like its token (Trevor, 2026-10-18). */
	.reminder[data-type='traveller'] {
		border-color: transparent;
		background:
			linear-gradient(var(--reminder-face) 0 0) padding-box,
			linear-gradient(to right, var(--good) 50%, var(--evil) 50%) border-box;
	}
	.reminder[data-type='fabled'] {
		--rim: var(--fabled);
	}
	.reminder[data-type='loric'] {
		--rim: var(--loric);
	}
	.infinite {
		margin-top: -12%;
		font-size: calc(var(--d) * 0.55);
		line-height: 1;
		color: var(--on-reminder);
	}
	img {
		width: 84%;
		height: 84%;
		margin-top: -16%;
		object-fit: contain;
		pointer-events: none;
	}
	/* The words sit across the bottom of the token, on a band so they stay legible. How wide
	   they may run and whether they wrap are settings (Board and tokens). The first line sits
	   where a single line does and wrapped lines grow downwards, below the token, so they never
	   cover the icon (Trevor, 2026-10-17); up to three lines, and a word wider than the limit
	   widens the band rather than being cut. */
	.label {
		position: absolute;
		left: 50%;
		/* The top of the first line: one line height above where a single line ends. */
		top: calc(100% + 0.125 * var(--u));
		translate: -50% -1.35em;
		width: max-content;
		max-width: calc(var(--d) * var(--reminder-label-width, 1.5));
		/* min-content when wrapping (the longest word), else 0: min-width beats max-width. */
		min-width: var(--reminder-label-min, 0);
		max-height: calc(3 * 1.35em);
		padding: 0 0.3em;
		overflow: hidden;
		border-radius: var(--radius-sm);
		/* Its own colour, the face's unless changed (Trevor, 2026-10-18). */
		background: var(--reminder-label-face, var(--reminder-face));
		box-shadow: 0 0 0 1.5px var(--rim);
		/* The Reminder tokens font, as reminders in text (Trevor, 2026-10-18: they match). */
		font-family: var(--font-reminder);
		font-size: calc(0.6rem * var(--reminder-scale, 1));
		font-variant: small-caps;
		line-height: 1.35;
		white-space: var(--reminder-label-wrap, nowrap);
		text-overflow: ellipsis;
		overflow-wrap: normal;
		text-align: center;
	}
	.more {
		font: 600 0.85rem / 1 var(--font-control);
	}
</style>
