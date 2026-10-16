<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { formatRoomCode, normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { RoomPlayer } from './player.svelte.ts';

	interface Props {
		/** The code from the link; undefined on /join, where it is typed. */
		code?: string;
	}

	let { code }: Props = $props();

	const valid = $derived(code === undefined ? null : normaliseRoomCode(code));
	let player = $state.raw<RoomPlayer>();
	let typed = $state('');
	let name = $state('');
	/** '' is "any seat". */
	let seat = $state<SeatId | ''>('');

	$effect(() => {
		if (!valid) return;
		const p = new RoomPlayer(valid);
		player = p;
		name = p.savedName;
		return () => p.stop();
	});

	const view = $derived(player?.view);
	const status = $derived(player?.status);
	const seats = $derived(view?.public?.seats ?? []);
	const mine = $derived(view?.me.seatId);
	const seatName = (seatId?: SeatId) => {
		const s = seats.find((x) => x.seatId === seatId);
		return s ? `seat ${s.seatNumber}` : 'any seat';
	};
	const summary = $derived.by(() => {
		if (!view) return status === 'offline' ? 'Offline: reconnecting…' : 'Joining the room…';
		if (view.request)
			return `Waiting for the Storyteller: ${view.request.name}, ${seatName(view.request.seatId)}.`;
		if (mine) return `You are in ${seatName(mine)} as ${view.me.name}.`;
		if (view.me.name) return `You are in the room as ${view.me.name}, without a seat yet.`;
		return 'Choose your seat and type your name, then ask the Storyteller.';
	});

	function enterCode(event: SubmitEvent) {
		event.preventDefault();
		const c = normaliseRoomCode(typed);
		if (c) void goto(resolve('/join/[code]', { code: c }));
	}

	function ask(event: SubmitEvent) {
		event.preventDefault();
		const n = name.trim();
		if (!n || !player) return;
		player.ask(n, seat || undefined);
	}
</script>

<main>
	<h1>{valid ? `Room ${formatRoomCode(valid)}` : 'Join a room'}</h1>

	{#if !valid || status === 'refused' || status === 'closed'}
		{#if code !== undefined}
			<p class="problem" role="alert">
				{!valid
					? 'That is not a room code. Codes are six digits.'
					: 'This room is closed, or the code is wrong.'}
			</p>
		{/if}
		<form class="code-form" onsubmit={enterCode}>
			<label for="room-code">Room code from the Storyteller</label>
			<input
				id="room-code"
				bind:value={typed}
				inputmode="numeric"
				autocomplete="off"
				enterkeyhint="go"
				placeholder="482 913"
				maxlength="7"
			/>
			<Button type="submit" variant="accent" disabled={!normaliseRoomCode(typed)}>Join</Button>
		</form>
	{:else}
		<div class="layout">
			<section aria-labelledby="you-label">
				<h2 id="you-label">You</h2>
				<p class="summary" role="status" data-testid="join-status">{summary}</p>
				<form onsubmit={ask}>
					<label for="player-name">Your name</label>
					<input
						id="player-name"
						bind:value={name}
						maxlength="40"
						autocomplete="nickname"
						enterkeyhint="done"
						onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
					/>
					<fieldset>
						<legend>Your seat</legend>
						<div class="seats">
							<label class="seat">
								<input type="radio" bind:group={seat} value="" />
								<span>Any seat</span>
							</label>
							{#each seats as s (s.seatId)}
								<label class="seat" data-mine={s.seatId === mine || undefined}>
									<input type="radio" bind:group={seat} value={s.seatId} />
									<span>Seat {s.seatNumber}</span>
									<span class="sub">
										{s.seatId === mine
											? 'You'
											: (s.playerName ?? (view?.takenSeats.includes(s.seatId) ? 'Taken' : 'Empty'))}
									</span>
								</label>
							{/each}
						</div>
					</fieldset>
					<div class="row">
						<Button type="submit" variant="accent" disabled={!name.trim() || status !== 'open'}>
							Ask the Storyteller
						</Button>
						<Button
							variant="quiet"
							disabled={!view?.request || status !== 'open'}
							onclick={() => player?.cancel()}
						>
							Cancel request
						</Button>
						<Button
							variant="quiet"
							disabled={!mine || status !== 'open'}
							onclick={() => player?.leaveSeat()}
						>
							Leave seat
						</Button>
					</div>
				</form>
			</section>

			<section aria-labelledby="table-label">
				<h2 id="table-label">Table</h2>
				{#if seats.length === 0}
					<p class="none">None</p>
				{:else}
					<ol class="table">
						{#each seats as s (s.seatId)}
							<li data-dead={s.dead || undefined} data-mine={s.seatId === mine || undefined}>
								<span class="number">{s.seatNumber}</span>
								<span class="name">{s.playerName ?? 'None'}</span>
								<span class="state">
									{s.dead ? 'Dead' : ''}
								</span>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		</div>
	{/if}
</main>

<style>
	main {
		display: grid;
		gap: var(--space-4);
		max-width: calc(72 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	main > :global(*) {
		min-width: 0;
	}
	h1 {
		margin: 0;
		font-size: 1.4rem;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.layout {
		display: grid;
		gap: var(--space-5);
	}
	/* A computer or tablet shows the table beside the form, not one long phone column. */
	@media (min-width: 48rem) {
		.layout {
			grid-template-columns: 1fr 1fr;
		}
	}
	section,
	form {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-width: 0;
	}
	.code-form {
		max-width: calc(28 * var(--u));
	}
	.problem,
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	/* Two lines reserved, so a longer status never moves the form. */
	.summary {
		min-height: 2.8em;
		margin: 0;
	}
	input:not([type='radio']) {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	legend {
		margin-bottom: var(--space-2);
		padding: 0;
	}
	.seats {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
		gap: var(--space-2);
	}
	.seat {
		display: grid;
		align-content: center;
		min-height: var(--tap-target);
		padding: var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		cursor: pointer;
	}
	.seat:has(input:checked) {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
	.seat:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.seat input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.sub {
		overflow: hidden;
		color: var(--on-surface-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.table {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.table li {
		display: grid;
		grid-template-columns: 2.5em 1fr auto;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.table li[data-mine] {
		border-color: var(--accent);
	}
	/* Dead seats are greyed, no skull (09-player-script-view.md). */
	.table li[data-dead] {
		color: var(--on-surface-muted);
	}
	.number {
		font-variant-numeric: tabular-nums;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.state {
		color: var(--on-surface-muted);
	}
</style>
