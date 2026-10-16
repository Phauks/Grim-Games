<script lang="ts">
	import { intl, t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
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
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import { MAX_SEATS, type NotebookSeat } from './notebook.ts';

	interface Props {
		seats: readonly NotebookSeat[];
		characters: ReadonlyMap<string, Character>;
		/** Where seats are drawn: the shared seat layout (ovals, gaps, couch groups). */
		layout: SeatLayout;
		/** Opens the Add a seat dialog (who sits down, and where). */
		onAddSeat: () => void;
		onOpenSeat: (seatId: string) => void;
		onLayout: (layout: SeatLayout) => void;
	}

	let { seats, characters, layout, onAddSeat, onOpenSeat, onLayout }: Props = $props();

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
	// The Character token size setting, capped by the ring spacing like the board (seat-layout).
	const size = $derived(
		seatTokenSize(ids, layout, { width, height }, preferences.current.tokenAppearance.tokenScale)
	);
	// Pulled in so edge seats never stick out past a narrow phone screen.
	const points = $derived(
		keepInside(seatPoints(ids, layout, { width, height }), { width, height }, size / 2 + 8)
	);

	/** Extra claims shown round the token: two, or one and "+N" when there are more. */
	const EXTRA_SLOTS = 2;

	// ── Arranging seats ──
	// Real tables have gaps, ovals and couch groups (Trevor, 2026-10-15). Only where seats are
	// drawn changes; seat numbers (the seating order) stay as they are.
	let arranging = $state(false);
	function startArranging() {
		arranging = true;
		toast(t('player.arrangeSeats'), t('player.arrangeHint'));
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
				onclick={() => onLayout(DEFAULT_SEAT_LAYOUT)}>{t('player.spreadEvenly')}</Button
			>
			<Button variant="accent" icon="check" onclick={() => (arranging = false)}
				>{t('player.done')}</Button
			>
		{:else}
			<!-- Adding is one deliberate flow, and removing is in the seat's sheet (Trevor). -->
			<Button icon="add" disabled={seats.length >= MAX_SEATS} onclick={onAddSeat}
				>{t('player.addSeatButton')}</Button
			>
			<span class="alive" data-testid="alive-count"
				>{t('player.aliveOf', { alive, count: seats.length })}</span
			>
			<span class="spacer"></span>
			<IconButton icon="arrange" label={t('player.arrangeSeats')} onclick={startArranging} />
		{/if}
	</div>

	<div class="board" class:arranging bind:this={board} data-testid="seat-ring">
		{#each seats as seat, i (seat.seatId)}
			{@const at = drag?.seatId === seat.seatId && arranging ? drag.at : points[i]}
			{@const claimed = seat.claims
				.map((id) => characters.get(id))
				.filter((c): c is Character => Boolean(c))}
			{@const claims = claimed.map((c) => c.name)}
			{@const extra = claimed.slice(1)}
			{@const shown = extra.length > EXTRA_SLOTS ? extra.slice(0, EXTRA_SLOTS - 1) : extra}
			{#snippet claimFace()}
				<CharacterToken character={claimed[0]} {size} />
			{/snippet}
			<button
				type="button"
				class="seat"
				class:dragging={arranging && drag?.seatId === seat.seatId}
				style:left="{at.x}%"
				style:top="{at.y}%"
				style:--seat-size="{size}px"
				style:--token-scale="1"
				data-seat={seat.seatId}
				data-dead={seat.dead || undefined}
				aria-label={[
					t('common.seat', { number: i + 1 }),
					seat.name,
					claims.length ? t('player.seatClaims', { characters: intl.list(claims) }) : '',
					seat.note.trim() ? t('player.seatHasNotes') : '',
					seat.dead ? t(seat.ghostVoteUsed ? 'player.seatDeadVoteUsed' : 'player.seatDead') : ''
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
				<!-- The board's seat look (Trevor, 2026-10-16): token, dead shroud, name beneath. -->
				<SeatDisc
					{size}
					dead={seat.dead}
					name={seat.name || t('common.seat', { number: i + 1 })}
					number={i + 1}
					face={claimed[0] ? claimFace : undefined}
				>
					{#snippet marks()}
						<!-- Every claim is visible: more tokens tucked under this one (Trevor). -->
						{#each shown as c, n (c.id)}
							<span class="extra" data-slot={n} data-testid="extra-claim" data-character={c.id}
								><CharacterToken character={c} size={Math.round(size * 0.46)} /></span
							>
						{/each}
						{#if extra.length > EXTRA_SLOTS}<span
								class="extra more"
								data-slot={EXTRA_SLOTS - 1}
								data-testid="more-claims">+{extra.length - shown.length}</span
							>{/if}
						{#if seat.dead && !seat.ghostVoteUsed}<span class="mark vote"
								><Icon name="ghostVote" /></span
							>{/if}
						{#if seat.note.trim()}<span class="mark noted" data-testid="has-notes"
								><Icon name="notes" /></span
							>{/if}
					{/snippet}
				</SeatDisc>
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
	.seat {
		position: absolute;
		/* Centred on the token; the name hangs below it (SeatDisc). */
		translate: -50% -50%;
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
	/* Extra claims tucked against the lower sides of the token, clear of the name. */
	.extra {
		position: absolute;
		bottom: 2%;
		display: grid;
		place-items: center;
		width: 46%;
		height: 46%;
		border-radius: 50%;
		box-shadow: var(--shadow);
	}
	.extra[data-slot='0'] {
		left: -24%;
	}
	.extra[data-slot='1'] {
		right: -24%;
	}
	.more {
		background: var(--surface-raised);
		color: var(--on-surface);
		font: 700 0.8rem / 1 var(--font-control);
		border: 1px solid var(--border);
	}
	/* Small marks on the top corners: a ghost vote left, notes right. */
	.mark {
		position: absolute;
		top: -6%;
		display: grid;
		place-items: center;
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
		border-radius: 50%;
		box-shadow: var(--shadow);
		--icon-size: calc(0.875 * var(--u));
	}
	.vote {
		left: -6%;
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.noted {
		right: -6%;
		background: var(--accent);
		color: var(--on-accent);
	}
</style>
