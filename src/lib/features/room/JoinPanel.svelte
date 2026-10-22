<script lang="ts">
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { formatRoomCode, normaliseRoomCode, ROOM_CODE_LENGTH } from '#lib/core/sync/room-code.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CodeField from '#lib/ui/primitives/CodeField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { viewerKeyFromPassword } from './viewer.svelte.ts';
	import SharedBoard from './SharedBoard.svelte';
	import ScriptBallot from './ScriptBallot.svelte';
	import VoteChoice from './VoteChoice.svelte';
	import { forgetRoom, type RoomPlayer } from './player.svelte.ts';
	import { releaseRoom, useRoom } from './room-connection.ts';
	import { followRoomScript } from './room-script.svelte.ts';
	import { fetchRoomPreview, type GamePreview } from './room-preview.ts';
	import { recentRooms, rememberRoom } from './recent-rooms.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';

	/**
	 * Joining a live room on a phone: the code form (with the game it opens), then your name
	 * and seat, the table, and the Specters vote. /play shows it
	 * in its Room tab (Trevor, 2026-10-19), so a player moves between script and room.
	 */
	interface Props {
		/** The room's code; undefined shows the code form. */
		code?: string;
		/**
		 * A typed code was entered. Without it the phone goes to /join/[code]; /play's Room
		 * tab switches rooms in place.
		 */
		onCode?: (code: string) => void;
		/** Told whether the phone is in a room (not the code form), for the page around it. */
		onJoined?: (joined: boolean) => void;
		/** Told the Storyteller's name the room gives, for the share text around it. */
		onStoryteller?: (name: string | undefined) => void;
	}

	let { code, onCode, onJoined, onStoryteller }: Props = $props();

	const valid = $derived(code === undefined ? null : normaliseRoomCode(code));
	let player = $state.raw<RoomPlayer>();
	let typed = $state('');
	let name = $state('');
	/** '' is "any seat". */
	let seat = $state<SeatId | ''>('');

	$effect(() => {
		if (!valid) return;
		const p = useRoom(valid);
		player = p;
		name = p.view?.me.name ?? p.savedName;
		return () => releaseRoom(p);
	});

	// The game's script becomes this phone's current script, for /play.
	$effect(() => {
		const sent = player?.script;
		const room = valid;
		if (!sent || !room) return;
		let cancelled = false;
		void followRoomScript(sent, room)
			.then((loaded) => {
				if (cancelled || !loaded) return;
				if (valid) rememberRoom(valid, loaded.name);
			})
			.catch(() => {});
		return () => (cancelled = true);
	});

	const view = $derived(player?.view);
	const status = $derived(player?.status);
	/** In a room (not the code form): the script, your seat and the table show. */
	const inRoom = $derived(!!valid && status !== 'refused' && status !== 'closed');
	$effect(() => onJoined?.(inRoom));
	// A closed or refused room is forgotten, so /play's Room tab opens on the code form.
	$effect(() => {
		if (valid && (status === 'refused' || status === 'closed')) forgetRoom(valid);
	});
	const seats = $derived(view?.public?.seats ?? []);
	const storyteller = $derived(view?.public?.storytellerName);
	$effect(() => onStoryteller?.(storyteller));
	const mine = $derived(view?.me.seatId);
	// The seat this phone has, or asked for, is the one chosen when the room opens again.
	const placed = $derived(
		view ? (view.request ? (view.request.seatId ?? '') : (mine ?? '')) : undefined
	);
	$effect(() => {
		if (placed !== undefined) seat = placed;
	});
	/** Asking again for the seat and name this phone already has changes nothing. */
	const unchanged = $derived(
		!!view && !view.request && !!mine && seat === mine && name.trim() === view.me.name
	);
	const seatName = (seatId?: SeatId) => {
		const s = seats.find((x) => x.seatId === seatId);
		return s ? t('room.seatLower', { number: s.seatNumber }) : t('room.anySeatLower');
	};
	const summary = $derived.by(() => {
		if (!view) return status === 'offline' ? t('room.playerOffline') : t('room.joining');
		if (view.choosing) return t('room.choosing');
		// The same words as the Storyteller's board once the game has ended.
		if (view.ended)
			return view.ended.winner === 'good'
				? t('room.gameOverGood')
				: view.ended.winner === 'evil'
					? t('room.gameOverEvil')
					: t('room.gameOver');
		if (view.request)
			return t('room.waiting', { name: view.request.name, seat: seatName(view.request.seatId) });
		if (mine) return t('room.seated', { seat: seatName(mine), name: view.me.name ?? '' });
		if (view.me.name) return t('room.unseated', { name: view.me.name });
		return t('room.choose');
	});

	// Specters: a spectators' vote opens over the page, once for each new vote.
	const vote = $derived(view?.vote);
	let voting = $state(false);
	let seenVote: string | undefined;
	$effect(() => {
		const id = vote?.voteId;
		if (id && id !== seenVote) voting = true;
		if (!id) voting = false;
		seenVote = id;
	});

	// Once all six digits are in, the page shows which game the code opens (Trevor,
	// 2026-10-19), so a mistyped code is caught before joining.
	const typedCode = $derived(code === undefined ? normaliseRoomCode(typed) : null);
	let lookup = $state.raw<
		| { code: string; state: 'looking' }
		| { code: string; state: 'found'; game: GamePreview }
		| { code: string; state: 'none' | 'failed' }
	>();
	$effect(() => {
		const c = typedCode;
		if (!c) {
			lookup = undefined;
			return;
		}
		const abort = new AbortController();
		lookup = { code: c, state: 'looking' };
		fetchRoomPreview(c, abort.signal).then(
			(game) => (lookup = game ? { code: c, state: 'found', game } : { code: c, state: 'none' }),
			() => {
				if (!abort.signal.aborted) lookup = { code: c, state: 'failed' };
			}
		);
		return () => abort.abort();
	});
	const found = $derived(lookup?.state === 'found' ? lookup.game : undefined);
	/** Joining goes ahead when the lookup fails (offline Worker, too many tries): the room page says why. */
	const canJoin = $derived(lookup?.state === 'found' || lookup?.state === 'failed');
	const lookupText = $derived(
		lookup?.state === 'looking'
			? t('room.lookingUp')
			: lookup?.state === 'none'
				? t('room.noGame')
				: lookup?.state === 'failed'
					? t('room.lookupFailed')
					: ''
	);

	// The rooms this phone joined, read once so the list keeps its rows while each is looked up.
	const recent = code === undefined ? recentRooms() : [];
	let recentGames = $state<Record<string, GamePreview | null>>({});
	$effect(() => {
		if (recent.length === 0) return;
		const abort = new AbortController();
		for (const room of recent) {
			fetchRoomPreview(room.code, abort.signal).then(
				(game) => {
					recentGames = { ...recentGames, [room.code]: game ?? null };
					if (!game) forgetRoom(room.code);
				},
				() => {}
			);
		}
		return () => abort.abort();
	});

	function openRoom(roomCode: string) {
		if (onCode) onCode(roomCode);
		else void goto(resolve('/join/[code]', { code: roomCode }));
	}

	function enterCode(event: SubmitEvent) {
		event.preventDefault();
		if (!lookup || !canJoin) return;
		openRoom(lookup.code);
	}

	/*
	 * Share grim (Trevor, 2026-10-20, plan R5): the finished grimoire the Storyteller shared
	 * opens over the page once when it arrives, and again from its button.
	 */
	const revealed = $derived(player?.revealed);
	let finalOpen = $state(false);
	let seenReveal: string | undefined;
	$effect(() => {
		const id = revealed?.gameId;
		if (id && id !== seenReveal) finalOpen = true;
		if (!id) finalOpen = false;
		seenReveal = id;
	});

	/*
	 * Grim view (plan D1, Trevor 2026-10-22: "grim view by password or direct link. drop
	 * spectate"): the room code and the Storyteller's password open the view-only grimoire.
	 * Players without a seat (Specters) join as players.
	 */
	let grimViewOpen = $state(false);
	let grimPassword = $state('');
	async function grimView(event: SubmitEvent) {
		event.preventDefault();
		const password = grimPassword.trim();
		if (!lookup || !password) return;
		const key = await viewerKeyFromPassword(lookup.code, password);
		grimViewOpen = false;
		grimPassword = '';
		// The key goes in the hash, which never reaches the server; the path is resolved.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(`${resolve('/watch/[code]', { code: lookup.code })}#${key}`, {
			state: { password: true }
		});
	}

	function ask(event: SubmitEvent) {
		event.preventDefault();
		const n = name.trim();
		if (!n || !player) return;
		player.ask(n, seat || undefined);
	}
</script>

{#if !inRoom}
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
		<CodeField
			id="room-code"
			bind:value={typed}
			length={ROOM_CODE_LENGTH}
			group={3}
			centred
			large
		/>
		<!-- Always this size, so the game arriving moves nothing. -->
		<section
			class="game"
			class:found={!!found}
			aria-label={t('room.gameToJoin')}
			aria-live="polite"
			data-testid="room-preview"
		>
			<ScriptLogo src={found?.logo} name={found?.name} class="game-logo" />
			<div class="game-text">
				{#if found}
					<p class="game-name">{found.name || t('room.noScriptYet')}</p>
					<ScriptByline author={found.author} inline />
					{#if found.storyteller}
						<span class="game-table" data-testid="game-storyteller"
							>{t('room.storytellerLine', { name: found.storyteller })}</span
						>
					{/if}
					{#if found.seats !== undefined}
						<span class="game-table"
							>{t('room.tableSize', { seats: found.seats, seated: found.seated ?? 0 })}</span
						>
					{/if}
				{:else}
					<p class="game-status" role="status">{lookupText}</p>
				{/if}
			</div>
		</section>
		<div class="entry">
			<Button type="submit" variant="accent" disabled={!canJoin}>
				{t('room.join')}
			</Button>
			<!-- Always here; disabled until the room has a Grim view password, so nothing moves. -->
			<Button disabled={!found?.grimView} onclick={() => (grimViewOpen = true)}
				>{t('room.grimView')}</Button
			>
		</div>
	</form>
	<Dialog bind:open={grimViewOpen} title={t('room.grimView')}>
		<form class="grim-view" onsubmit={grimView}>
			<TextField
				label={t('room.watch.password')}
				bind:value={grimPassword}
				maxlength={64}
				type="password"
				autocomplete="off"
			/>
			<ModalActions
				onCancel={() => (grimViewOpen = false)}
				disabled={!grimPassword.trim()}
				submit
			/>
		</form>
	</Dialog>
	{#if recent.length > 0}
		<PageSection title={t('room.yourGames')}>
			<ul class="recent" data-testid="recent-rooms">
				{#each recent as room (room.code)}
					{@const game = recentGames[room.code]}
					<li>
						<button
							type="button"
							class="recent-game"
							disabled={game === null}
							onclick={() => openRoom(room.code)}
						>
							<ScriptLogo src={game?.logo} name={game?.name ?? room.script} class="recent-logo" />
							<span class="recent-text">
								<span class="recent-name"
									>{(game?.name ?? room.script) || t('room.noScriptYet')}</span
								>
								<span class="recent-line"
									>{game === null
										? t('room.recentClosed', { code: formatRoomCode(room.code) })
										: game?.storyteller
											? t('room.recentLine', {
													code: formatRoomCode(room.code),
													name: game.storyteller
												})
											: formatRoomCode(room.code)}</span
								>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		</PageSection>
	{/if}
{:else}
	<PageSection title={t('room.you')}>
		<p class="summary" role="status" data-testid="join-status">{summary}</p>
		<!-- Share grim (plan R5): in its place all game, usable once the Storyteller shares it. -->
		<Button icon="grimoire" disabled={!revealed} onclick={() => (finalOpen = true)}
			>{t('room.finalGrimoire')}</Button
		>
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
				<Button
					type="submit"
					variant="accent"
					disabled={!name.trim() || unchanged || status !== 'open'}
				>
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
	</PageSection>
	<PageSection title={t('room.table')}>
		{#if seats.length === 0}
			<p class="none">{t('common.none')}</p>
		{:else}
			<p class="storyteller" data-testid="room-storyteller">
				{t('room.storytellerLine', { name: storyteller ?? t('common.none') })}
			</p>
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
	</PageSection>
{/if}

<Dialog bind:open={voting} title={t('room.vote.title')}>
	<!-- What the vote is for, as the Storyteller set it (Specters, Trevor 2026-10-18). -->
	{#if vote?.ability}<p class="ability" data-testid="spectator-ability">{vote.ability}</p>{/if}
	<ul class="vote" data-testid="spectator-vote">
		{#each vote?.options ?? [] as option (option)}
			{@const s = seats.find((x) => x.seatId === option)}
			<li>
				<VoteChoice
					mark={s?.seatNumber}
					pressed={vote?.choice === option}
					disabled={status !== 'open'}
					onclick={() => player?.vote(option)}
					>{s?.playerName ?? t('common.seat', { number: s?.seatNumber ?? 0 })}</VoteChoice
				>
			</li>
		{/each}
	</ul>
</Dialog>

<Dialog bind:open={finalOpen} title={t('room.finalGrimoire')} size="max" scroll={false}>
	<div class="final" data-testid="final-grimoire">
		<SharedBoard shared={revealed?.grimoire} />
	</div>
</Dialog>
{#if player}<ScriptBallot {player} />{/if}

<style>
	form {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-width: 0;
	}
	/* The code, the game it opens and Join, down the middle of the page. */
	.code-form {
		justify-items: center;
		gap: var(--space-4);
		width: 100%;
		max-width: calc(28 * var(--u));
		margin-inline: auto;
		padding-block: var(--space-4);
		text-align: center;
	}
	.code-form label {
		font-size: 1.1rem;
	}
	.game {
		display: grid;
		grid-template-columns: calc(4.5 * var(--u)) minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		box-sizing: border-box;
		width: 100%;
		/* Room for the name, the author, the Storyteller and the table, so none of them moves the page. */
		min-height: calc(9 * var(--u));
		padding: var(--space-3);
		border: 1px dashed var(--border);
		border-radius: var(--radius-md);
		text-align: start;
	}
	.game.found {
		border-style: solid;
		background: var(--surface-raised);
	}
	.game :global(.game-logo) {
		width: calc(4.5 * var(--u));
		height: calc(4.5 * var(--u));
	}
	.game-text {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}
	.game-name {
		margin: 0;
		overflow: hidden;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: 1.3rem;
		line-height: 1.2;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.game-table,
	.game-status {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.entry {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
	}
	.final {
		position: relative;
		height: 100%;
		min-height: 0;
	}
	.grim-view {
		display: grid;
		gap: var(--space-4);
	}
	.code-form :global(.button) {
		min-width: calc(10 * var(--u));
	}
	.recent {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Two lines always, so a room's details arriving move nothing. */
	.recent-game {
		display: grid;
		grid-template-columns: calc(2.5 * var(--u)) minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.recent-game:disabled {
		cursor: default;
		opacity: 0.55;
	}
	.recent-game :global(.recent-logo) {
		width: calc(2.5 * var(--u));
		height: calc(2.5 * var(--u));
	}
	.recent-text {
		display: grid;
		min-width: 0;
	}
	.recent-name,
	.recent-line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recent-name {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
	}
	.recent-line {
		color: var(--on-surface-muted);
	}
	.problem,
	.storyteller,
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
	.ability {
		margin: 0 0 var(--space-2);
	}
	.vote {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
