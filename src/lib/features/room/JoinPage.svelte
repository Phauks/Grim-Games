<script lang="ts">
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { formatRoomCode, normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { RoomPlayer } from './player.svelte.ts';
	import { followRoomScript } from './room-script.ts';

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

	// The game's script becomes this phone's current script, for /play.
	let scriptName = $state<string>();
	$effect(() => {
		const sent = player?.script;
		if (!sent) return;
		let cancelled = false;
		void followRoomScript(sent)
			.then((loaded) => {
				if (!cancelled && loaded) scriptName = loaded.name;
			})
			.catch(() => {});
		return () => (cancelled = true);
	});

	const view = $derived(player?.view);
	const status = $derived(player?.status);
	const seats = $derived(view?.public?.seats ?? []);
	const mine = $derived(view?.me.seatId);
	const seatName = (seatId?: SeatId) => {
		const s = seats.find((x) => x.seatId === seatId);
		return s ? t('room.seatLower', { number: s.seatNumber }) : t('room.anySeatLower');
	};
	const summary = $derived.by(() => {
		if (!view) return status === 'offline' ? t('room.playerOffline') : t('room.joining');
		if (view.request)
			return t('room.waiting', { name: view.request.name, seat: seatName(view.request.seatId) });
		if (mine) return t('room.seated', { seat: seatName(mine), name: view.me.name ?? '' });
		if (view.me.name) return t('room.unseated', { name: view.me.name });
		return t('room.choose');
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
	<h1>{valid ? t('room.roomTitle', { code: formatRoomCode(valid) }) : t('room.joinTitle')}</h1>

	{#if !valid || status === 'refused' || status === 'closed'}
		{#if code !== undefined}
			<p class="problem" role="alert">
				{!valid
					? t('room.notACode')
					: player?.refusedReason === 'too-old'
						? t('room.tooOld')
						: t('room.closedOrWrong')}
			</p>
		{/if}
		<form class="code-form" onsubmit={enterCode}>
			<label for="room-code">{t('room.codeLabel')}</label>
			<ClearableField bind:value={typed}>
				<input
					id="room-code"
					bind:value={typed}
					inputmode="numeric"
					autocomplete="off"
					enterkeyhint="go"
					placeholder="482 913"
					maxlength="7"
				/>
			</ClearableField>
			<Button type="submit" variant="accent" disabled={!normaliseRoomCode(typed)}>
				{t('room.join')}
			</Button>
		</form>
	{:else}
		<section class="script" aria-labelledby="script-label">
			<h2 id="script-label">{t('room.script')}</h2>
			<p class="script-name" data-testid="room-script">
				{scriptName === undefined ? t('common.none') : scriptName || t('common.none')}
			</p>
			<Button
				icon="script"
				disabled={scriptName === undefined}
				onclick={() => goto(resolve('/play'))}
			>
				{t('room.readScript')}
			</Button>
		</section>

		<div class="layout">
			<section aria-labelledby="you-label">
				<h2 id="you-label">{t('room.you')}</h2>
				<p class="summary" role="status" data-testid="join-status">{summary}</p>
				<form onsubmit={ask}>
					<label for="player-name">{t('room.yourName')}</label>
					<ClearableField bind:value={name}>
						<input
							id="player-name"
							bind:value={name}
							maxlength="40"
							autocomplete="nickname"
							enterkeyhint="done"
							onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
						/>
					</ClearableField>
					<fieldset>
						<legend>{t('room.yourSeat')}</legend>
						<div class="seats">
							<label class="seat">
								<input type="radio" bind:group={seat} value="" />
								<span>{t('room.anySeat')}</span>
							</label>
							{#each seats as s (s.seatId)}
								<label class="seat" data-mine={s.seatId === mine || undefined}>
									<input type="radio" bind:group={seat} value={s.seatId} />
									<span>{t('common.seat', { number: s.seatNumber })}</span>
									<span class="sub">
										{s.seatId === mine
											? t('room.mine')
											: (s.playerName ??
												(view?.takenSeats.includes(s.seatId) ? t('room.taken') : t('room.empty')))}
									</span>
								</label>
							{/each}
						</div>
					</fieldset>
					<div class="row">
						<Button type="submit" variant="accent" disabled={!name.trim() || status !== 'open'}>
							{t('room.ask')}
						</Button>
						<Button
							variant="quiet"
							disabled={!view?.request || status !== 'open'}
							onclick={() => player?.cancel()}
						>
							{t('room.cancelRequest')}
						</Button>
						<Button
							variant="quiet"
							disabled={!mine || status !== 'open'}
							onclick={() => player?.leaveSeat()}
						>
							{t('room.leaveSeat')}
						</Button>
					</div>
				</form>
			</section>

			<section aria-labelledby="table-label">
				<h2 id="table-label">{t('room.table')}</h2>
				{#if seats.length === 0}
					<p class="none">{t('common.none')}</p>
				{:else}
					<ol class="table">
						{#each seats as s (s.seatId)}
							<li data-dead={s.dead || undefined} data-mine={s.seatId === mine || undefined}>
								<span class="number">{s.seatNumber}</span>
								<span class="name">{s.playerName ?? t('common.none')}</span>
								<span class="state">
									{s.dead ? t('room.dead') : ''}
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
		max-width: var(--page-max);
		margin: 0 auto;
		padding: var(--space-4) var(--page-gutter);
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
	/* One row: the name takes the space, the button keeps its place when the script arrives. */
	.script {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.script-name {
		flex: 1;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
