<script lang="ts">
	import {
		characterIcons,
		defaultAlignment,
		ICONS_PATH,
		type Character
	} from '#lib/core/data/index.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { MAX_SEATS, MIN_SEATS, type NotebookSeat } from './notebook.ts';

	interface Props {
		seats: readonly NotebookSeat[];
		me?: string;
		characters: ReadonlyMap<string, Character>;
		onSeatCount: (count: number) => void;
		onOpenSeat: (seatId: string) => void;
	}

	let { seats, me, characters, onSeatCount, onOpenSeat }: Props = $props();

	const RADIUS = 38; // % of the ring's width, from the centre to each seat's centre
	function place(i: number, n: number) {
		const angle = (2 * Math.PI * i) / n; // seat 1 at the top, then clockwise
		return { x: 50 + RADIUS * Math.sin(angle), y: 50 - RADIUS * Math.cos(angle) };
	}
	// Seats shrink as the ring fills, but never below a 44px tap target.
	const seatSize = $derived(
		`clamp(var(--tap-target), ${(RADIUS * 2 * Math.sin(Math.PI / seats.length) * 0.8).toFixed(2)}cqi, min(72px, 18cqi))`
	);
	const alive = $derived(seats.filter((s) => !s.dead).length);

	function iconFor(id: string | undefined) {
		const c = id ? characters.get(id) : undefined;
		const icons = c && characterIcons(c);
		if (!c || !icons) return undefined;
		const file = (defaultAlignment(c.type) === 'evil' ? icons.evil : icons.good) ?? icons.unaligned;
		return file && `${ICONS_PATH}/${file}`;
	}

	// Taps come from Pointer Events (CLAUDE.md: touch first); a drag that moves is not a tap.
	let down: { x: number; y: number } | null = null;
	const TAP_SLOP = 10;
	function pointerup(event: PointerEvent, seatId: string) {
		if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < TAP_SLOP)
			onOpenSeat(seatId);
		down = null;
	}
</script>

<div class="ring" style:--seat-size={seatSize} data-testid="seat-ring">
	<div class="centre">
		<span class="label" id="seat-count-label">Seats</span>
		<div class="stepper" role="group" aria-labelledby="seat-count-label">
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
	</div>

	{#each seats as seat, i (seat.seatId)}
		{@const p = place(i, seats.length)}
		{@const icon = iconFor(seat.guess)}
		{@const guess = seat.guess ? characters.get(seat.guess) : undefined}
		<button
			type="button"
			class="seat"
			style:left="{p.x}%"
			style:top="{p.y}%"
			data-seat={seat.seatId}
			data-me={seat.seatId === me || undefined}
			data-dead={seat.dead || undefined}
			aria-label={[
				`Seat ${i + 1}`,
				seat.name,
				seat.seatId === me ? 'you' : '',
				guess ? `guess ${guess.name}` : '',
				seat.dead ? (seat.ghostVoteUsed ? 'dead, vote used' : 'dead') : ''
			]
				.filter(Boolean)
				.join(', ')}
			onpointerdown={(event) => (down = { x: event.clientX, y: event.clientY })}
			onpointerup={(event) => pointerup(event, seat.seatId)}
			onpointercancel={() => (down = null)}
			onclick={(event) => event.detail === 0 && onOpenSeat(seat.seatId)}
		>
			<span class="face">
				{#if icon}<img src={icon} alt="" />{:else}<span class="number">{i + 1}</span>{/if}
				{#if seat.dead}<span class="shroud"><Icon name="dead" /></span>{/if}
				{#if seat.dead && !seat.ghostVoteUsed}<span class="vote"><Icon name="ghostVote" /></span
					>{/if}
			</span>
			<span class="name">{seat.name || ' '}</span>
		</button>
	{/each}
</div>

<style>
	.ring {
		position: relative;
		width: 100%;
		max-width: 36rem;
		aspect-ratio: 1;
		margin: 0 auto;
		container-type: inline-size;
	}
	.ring::before {
		content: '';
		position: absolute;
		inset: 8%;
		border: 1px dashed var(--border);
		border-radius: 50%;
	}
	.centre {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		display: grid;
		justify-items: center;
		gap: var(--space-1);
	}
	.label,
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
		translate: -50% -50%;
		display: grid;
		justify-items: center;
		width: var(--seat-size);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
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
	.seat[data-me] .face {
		box-shadow:
			0 0 0 2px var(--token-rim),
			0 0 0 5px var(--accent);
	}
	.face img {
		width: 88%;
		height: 88%;
	}
	.number {
		font-weight: 700;
		font-size: 1.1rem;
	}
	.shroud {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: color-mix(in srgb, var(--surface) 70%, transparent);
		color: var(--on-surface);
		--icon-size: 55%;
	}
	.vote {
		position: absolute;
		right: -4px;
		top: -4px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		--icon-size: 14px;
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
