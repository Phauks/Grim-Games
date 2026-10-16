<script lang="ts">
	import {
		characterIcons,
		defaultAlignment,
		ICONS_PATH,
		type Character
	} from '#lib/core/data/index.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import {
		DEFAULT_SEAT_LAYOUT,
		isDefaultLayout,
		keepInside,
		seatPoints,
		seatTokenSize,
		withPlaced,
		type SeatLayout,
		type SeatPoint
	} from '#lib/ui/seating/seat-layout.ts';
	import { MAX_SEATS, MIN_SEATS, type NotebookSeat } from './notebook.ts';

	interface Props {
		seats: readonly NotebookSeat[];
		characters: ReadonlyMap<string, Character>;
		/** Where seats are drawn: the shared seat layout (ovals, gaps, couch groups). */
		layout: SeatLayout;
		onSeatCount: (count: number) => void;
		onOpenSeat: (seatId: string) => void;
		onLayout: (layout: SeatLayout) => void;
	}

	let { seats, characters, layout, onSeatCount, onOpenSeat, onLayout }: Props = $props();

	const ids = $derived(seats.map((s) => s.seatId));
	const alive = $derived(seats.filter((s) => !s.dead).length);

	let board = $state<HTMLElement>();
	let width = $state(0);
	let height = $state(0);
	// Measured on the next frame, so resizing tokens never re-enters the observer.
	$effect(() => {
		if (!board) return;
		let frame = 0;
		const observer = new ResizeObserver(([entry]) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				width = entry.contentRect.width;
				height = entry.contentRect.height;
			});
		});
		observer.observe(board);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});
	const size = $derived(seatTokenSize(ids, layout, { width, height }));
	// Pulled in so edge seats never stick out past a narrow phone screen.
	const points = $derived(
		keepInside(seatPoints(ids, layout, { width, height }), { width, height }, size / 2 + 8)
	);

	function iconFor(id: string | undefined) {
		const c = id ? characters.get(id) : undefined;
		const icons = c && characterIcons(c);
		if (!c || !icons) return undefined;
		const file = (defaultAlignment(c.type) === 'evil' ? icons.evil : icons.good) ?? icons.unaligned;
		return file && `${ICONS_PATH}/${file}`;
	}

	// ── Arranging seats ──
	// Real tables have gaps, ovals and couch groups (Trevor, 2026-10-15). Only where seats are
	// drawn changes; seat numbers (the seating order) stay as they are.
	let arranging = $state(false);
	function startArranging() {
		arranging = true;
		toast('Arrange seats', 'Drag a seat to move it, leaving space where people sit apart.');
	}

	interface Drag {
		seatId: string;
		pointerId: number;
		/** From the pointer to the seat's centre, so the seat does not jump under a finger. */
		offset: SeatPoint;
		at: SeatPoint;
		moved: boolean;
	}
	let drag = $state<Drag | undefined>();
	/** Pointer movement, in pixels, before a press counts as a drag rather than a tap. */
	const SLOP = 8;
	let pressedAt = { x: 0, y: 0 };

	function boardPoint(event: PointerEvent): SeatPoint {
		const rect = board!.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.height) * 100
		};
	}
	// Pointer Events for taps and drags (CLAUDE.md: touch first); a press that moves is not a tap.
	function pointerdown(event: PointerEvent, seatId: string, at: SeatPoint) {
		if (drag || !board) return;
		pressedAt = { x: event.clientX, y: event.clientY };
		if (arranging) (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		const p = boardPoint(event);
		drag = {
			seatId,
			pointerId: event.pointerId,
			offset: { x: at.x - p.x, y: at.y - p.y },
			at,
			moved: false
		};
	}
	function pointermove(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const moved =
			drag.moved || Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) >= SLOP;
		if (!arranging) {
			drag = { ...drag, moved };
			return;
		}
		const p = boardPoint(event);
		drag = { ...drag, moved, at: { x: p.x + drag.offset.x, y: p.y + drag.offset.y } };
	}
	function pointerup(event: PointerEvent) {
		if (!drag || event.pointerId !== drag.pointerId) return;
		const { seatId, moved, at } = drag;
		drag = undefined;
		if (arranging && moved) onLayout(withPlaced(layout, seatId, at));
		else if (!arranging && !moved) onOpenSeat(seatId);
	}
	/** Arrow keys move a seat while arranging, for keyboards and switch access. */
	function nudge(event: KeyboardEvent, seatId: string, at: SeatPoint) {
		if (!arranging) return;
		const step = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[
			event.key
		];
		if (!step) return;
		event.preventDefault();
		onLayout(withPlaced(layout, seatId, { x: at.x + step[0], y: at.y + step[1] }));
	}
</script>

<div class="circle">
	<!-- One bar whose controls swap while arranging, so the board never moves. -->
	<div class="bar">
		{#if arranging}
			<span class="spacer"></span>
			<!-- Matches the board (Trevor): everyone back on the oval, evenly spaced. -->
			<Button
				variant="quiet"
				disabled={isDefaultLayout(layout)}
				onclick={() => onLayout(DEFAULT_SEAT_LAYOUT)}>Spread evenly</Button
			>
			<Button variant="accent" icon="check" onclick={() => (arranging = false)}>Done</Button>
		{:else}
			<div class="stepper" role="group" aria-label="Seats">
				<button
					type="button"
					class="step"
					aria-label="Remove a seat"
					disabled={seats.length <= MIN_SEATS}
					onclick={() => onSeatCount(seats.length - 1)}>−</button
				>
				<output aria-live="polite" data-testid="seat-count">{seats.length}</output>
				<button
					type="button"
					class="step"
					aria-label="Add a seat"
					disabled={seats.length >= MAX_SEATS}
					onclick={() => onSeatCount(seats.length + 1)}>+</button
				>
			</div>
			<span class="alive" data-testid="alive-count">{alive} alive</span>
			<span class="spacer"></span>
			<IconButton icon="arrange" label="Arrange seats" onclick={startArranging} />
		{/if}
	</div>

	<div class="board" class:arranging bind:this={board} data-testid="seat-ring">
		{#each seats as seat, i (seat.seatId)}
			{@const at = drag?.seatId === seat.seatId && arranging ? drag.at : points[i]}
			{@const icon = iconFor(seat.claims[0])}
			{@const claims = seat.claims.map((id) => characters.get(id)?.name).filter(Boolean)}
			<button
				type="button"
				class="seat"
				class:dragging={arranging && drag?.seatId === seat.seatId}
				style:left="{at.x}%"
				style:top="{at.y}%"
				style:--seat-size="{size}px"
				data-seat={seat.seatId}
				data-dead={seat.dead || undefined}
				aria-label={[
					`Seat ${i + 1}`,
					seat.name,
					claims.length ? `claims ${claims.join(' and ')}` : '',
					seat.note.trim() ? 'has notes' : '',
					seat.dead ? (seat.ghostVoteUsed ? 'dead, vote used' : 'dead') : ''
				]
					.filter(Boolean)
					.join(', ')}
				onpointerdown={(event) => pointerdown(event, seat.seatId, at)}
				onpointermove={pointermove}
				onpointerup={pointerup}
				onpointercancel={() => (drag = undefined)}
				onkeydown={(event) => nudge(event, seat.seatId, at)}
				onclick={(event) => event.detail === 0 && !arranging && onOpenSeat(seat.seatId)}
			>
				<span class="face">
					{#if icon}<img src={icon} alt="" />{:else}<span class="number">{i + 1}</span>{/if}
					{#if seat.dead && !seat.ghostVoteUsed}<span class="vote"><Icon name="ghostVote" /></span
						>{/if}
					{#if claims.length > 1}<span class="more" data-testid="more-claims"
							>+{claims.length - 1}</span
						>{/if}
					{#if seat.note.trim()}<span class="noted" data-testid="has-notes"
							><Icon name="notes" /></span
						>{/if}
				</span>
				<span class="name">{seat.name || ' '}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.circle {
		display: grid;
		gap: var(--space-2);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1) var(--space-2);
		min-height: var(--tap-target);
	}
	.spacer {
		flex: 1;
	}
	/* A fixed size, so the seats never move as data arrives. Ovals fill it (seat-layout). */
	.board {
		position: relative;
		width: 100%;
		max-width: 48rem;
		height: clamp(20rem, 62dvh, 40rem);
		/* Room for the bottom seat's name, which hangs below the board's edge. */
		margin: 0 auto var(--space-5);
		touch-action: manipulation;
	}
	/* While arranging, a press drags a seat instead of scrolling. */
	.arranging {
		touch-action: none;
		outline: 1px dashed var(--border);
		outline-offset: var(--space-1);
		border-radius: var(--radius-md);
	}
	.alive {
		color: var(--on-surface-muted);
		font-family: var(--font-control);
	}
	.stepper {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.step {
		width: var(--tap-target);
		height: var(--tap-target);
		border: 1px solid var(--border);
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		font-size: 1.4rem;
		line-height: 1;
		cursor: pointer;
		touch-action: manipulation;
	}
	.step:hover:not(:disabled) {
		background: var(--surface-selected);
	}
	.step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	output {
		min-width: 2ch;
		text-align: center;
		font-size: 1.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.seat {
		position: absolute;
		/* Centred on the token, with the name hanging below. */
		translate: -50% calc(-50% + 0.6em);
		display: grid;
		justify-items: center;
		/* As wide as the name below the token, so the token is centred on its point. */
		width: calc(var(--seat-size) + 2rem);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	.arranging .seat {
		cursor: grab;
	}
	.seat.dragging {
		z-index: 2;
		cursor: grabbing;
	}
	.face {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--seat-size);
		height: var(--seat-size);
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		box-shadow: 0 0 0 2px var(--token-rim);
	}
	.face img {
		width: 88%;
		height: 88%;
	}
	.number {
		font-weight: 700;
		font-size: 1.1rem;
	}
	/* Dead: greyed out, so the claim stays visible (Trevor, 2026-10-15). */
	.seat[data-dead] .face {
		background: color-mix(in srgb, var(--token-face) 35%, var(--surface));
	}
	.seat[data-dead] .face img,
	.seat[data-dead] .number {
		filter: grayscale(1);
		opacity: 0.55;
	}
	.seat[data-dead] .name {
		color: var(--on-surface-muted);
		text-decoration: line-through;
	}
	/* Markers sit inside the token, like its leaves. */
	.vote,
	.noted {
		position: absolute;
		right: 6%;
		top: 6%;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		--icon-size: 14px;
	}
	/* More than one claim: how many more, top left (Trevor, 2026-10-16). */
	.more {
		position: absolute;
		left: 6%;
		top: 6%;
		min-width: 20px;
		height: 20px;
		padding: 0 3px;
		border-radius: 10px;
		background: var(--surface-raised);
		color: var(--on-surface);
		font: 700 0.7rem / 20px var(--font-control);
		text-align: center;
	}
	.noted {
		top: auto;
		bottom: 6%;
		background: var(--accent);
		color: var(--on-accent);
	}
	.name {
		/* Absolutely sized so long or missing names never move the ring. */
		width: calc(var(--seat-size) + 2rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: var(--font-player);
		font-size: 0.8rem;
		line-height: 1.2;
		text-align: center;
	}
</style>
