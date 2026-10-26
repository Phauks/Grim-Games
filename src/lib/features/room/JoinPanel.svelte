<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { normaliseRoomCode, ROOM_CODE_LENGTH, scannedRoom } from '#lib/core/sync/room-code.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import CodeField from '#lib/ui/primitives/CodeField.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import QrScanner from '#lib/ui/share/QrScanner.svelte';
	import { QrFrameCollector } from '#lib/core/codes/qr-frames.ts';
	import { sharedRefFromHash } from '#lib/features/scripts/share.ts';
	import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';
	import { viewerKeyFromPassword } from './viewer.svelte.ts';
	import ScriptBallot from './ScriptBallot.svelte';
	import FeedbackSheet from './FeedbackSheet.svelte';
	import VoteChoice from './VoteChoice.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { forgetRoom, type RoomPlayer } from './player.svelte.ts';
	import { releaseRoom, useRoom } from './room-connection.ts';
	import { followRoomScript } from './room-script.svelte.ts';
	import { fetchRoomPreview, type GamePreview } from './room-preview.ts';
	import { rememberRoom } from './recent-rooms.ts';
	import YourGames from './YourGames.svelte';
	import YourCharacter from './YourCharacter.svelte';
	import { finalGrimoire } from './final-grimoire.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import PlayersDayStatus from '#lib/features/day/PlayersDayStatus.svelte';
	import { dayTimers, parsePlayersPhase } from '#lib/core/rules/index.ts';

	/**
	 * Joining a live room on a phone: the code form (with the game it opens), then one "You" row
	 * over /play's tabs, which says where this phone sits (plan J12: no Room tab), and the
	 * Specters vote. The player sets only the name that shows, from You on the title line
	 * (YouDialog, plan E2); the Storyteller seats them (Trevor, 2026-10-25).
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
		/** Told when the phone has a seat here, or has asked for one, as it does or on its return. */
		onSeated?: () => void;
		/** Told whether a room vote is open, when the ballot is the page's content (2026-10-26). */
		onVoting?: (voting: boolean) => void;
		/**
		 * Whether the code form shows while the phone is not in a room (Join game); /play's
		 * own row for the last room shows nothing then.
		 */
		entry?: boolean;
	}

	let { code, onCode, onJoined, onStoryteller, onSeated, onVoting, entry = true }: Props = $props();

	const valid = $derived(code === undefined ? null : normaliseRoomCode(code));
	let player = $state.raw<RoomPlayer>();
	let typed = $state('');
	// The room's link and QR open Join game with its code filled in (Trevor, 2026-10-26), so
	// the person picks Join as player, Grim view or Public Town.
	// Once, as the panel opens: what is typed after is the person's own.
	untrack(() => {
		if (code !== undefined || !entry || typeof location === 'undefined') return;
		const fromLink = normaliseRoomCode(location.hash.slice(1));
		if (fromLink) typed = fromLink;
	});

	$effect(() => {
		if (!valid) return;
		// Only the code is tracked: opening the room reads settings (the avatar, the frame).
		const p = untrack(() => useRoom(valid));
		player = p;
		return () => releaseRoom(p);
	});

	// The player's avatar and frame go to the room as they pick them (plan R6).
	$effect(() => {
		void playerSettings.current.avatar;
		void playerSettings.current.frame;
		void player?.view;
		player?.sendLook();
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
	/**
	 * The Storyteller's day timer, as they chose to show it (Trevor, 2026-10-26); their board
	 * sends it during the day only.
	 */
	const phase = $derived(view?.endedGameId ? undefined : parsePlayersPhase(view?.public?.now));
	const dayTimer = $derived(
		view?.endedGameId ? undefined : dayTimers.parsePublicTimer(view?.public?.timer)
	);
	const status = $derived(player?.status);
	/** In a room (not the code form): the script, your seat and the table show. */
	const inRoom = $derived(!!valid && status !== 'refused' && status !== 'closed');
	$effect(() => onJoined?.(inRoom));
	/** A room vote is open: its ballot is the screen, under the room row (Trevor, 2026-10-26). */
	const balloting = $derived(inRoom && !!view?.scriptVote);
	$effect(() => onVoting?.(balloting));
	// A closed or refused room is forgotten, so /play's Room tab opens on the code form.
	$effect(() => {
		if (valid && (status === 'refused' || status === 'closed')) forgetRoom(valid);
	});
	const seats = $derived(view?.public?.seats ?? []);
	const storyteller = $derived(view?.public?.storytellerName);
	$effect(() => onStoryteller?.(storyteller));
	const mine = $derived(view?.me.seatId);
	$effect(() => {
		if (view?.me.name || mine) untrack(() => onSeated?.());
	});
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
		if (mine) return t('room.seated', { seat: seatName(mine), name: view.me.name ?? '' });
		if (view.me.name) return t('room.unseated', { name: view.me.name });
		return t('room.choose');
	});

	// Specters: a spectators' vote opens over the page, once for each new vote.
	const vote = $derived(view?.vote);
	let voting = $state(false);
	let rating = $state(false);
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
	 * Share grim (Trevor, 2026-10-20, plan R5): when the finished grimoire the Storyteller
	 * shared arrives, /play turns to its Grim tab, where it shows (Trevor, 2026-10-24).
	 */
	const revealed = $derived(player?.revealed);
	let seenReveal: string | undefined;
	$effect(() => {
		const id = revealed?.gameId;
		if (id && id !== seenReveal) finalGrimoire.open = true;
		if (!id) finalGrimoire.open = false;
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

	/*
	 * Scan a code (plan J2, 2026-10-22): the Share screen's QR code read in the app, or an
	 * older players or Grim view link, or a room code on its own.
	 */
	let scanning = $state(false);
	let scanProblem = $state('');
	/** An animated code's frames read so far (offline codes, Trevor 2026-10-26). */
	let scanProgress = $state('');
	let frames = new QrFrameCollector();
	$effect(() => {
		if (scanning) return;
		scanProblem = '';
		scanProgress = '';
		frames = new QrFrameCollector();
	});
	function scanned(text: string): boolean {
		const frame = frames.add(text);
		if (frame?.kind === 'frame') {
			scanProblem = '';
			scanProgress = t('share.scan.frames', { read: frame.read, total: frame.total });
			return false;
		}
		const read = frame?.kind === 'done' ? frame.text : text;
		const room = scannedRoom(read);
		if (!room) {
			if (openScannedScript(read)) return true;
			scanProblem = t('room.scanNotRoom');
			return false;
		}
		scanning = false;
		// A players' code fills the boxes and shows its game, so the choice of Join as player
		// or ⋯ (Public Town) is still the person's (Trevor, 2026-10-26: one QR, no third).
		if (room.kind === 'join' && code === undefined) typed = room.code;
		else if (room.kind === 'join') openRoom(room.code);
		// The key stays in the hash, which never reaches the server; the path is resolved.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		else void goto(`${resolve('/watch/[code]', { code: room.code })}#${room.key}`);
		return true;
	}

	/**
	 * A script's link (a Share screen's QR code, or an offline code, Trevor 2026-10-26) opens
	 * on this app's own /play, whichever site made it, so an offline code needs no internet.
	 */
	function openScannedScript(text: string): boolean {
		let url: URL;
		try {
			url = new URL(text.trim());
		} catch {
			return false;
		}
		if (!/\/(play|scripts)\/?$/.test(url.pathname) || !sharedRefFromHash(url.hash)) return false;
		scanning = false;
		// The script travels in the hash, which never reaches the server; the path is resolved.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(`${resolve('/play')}${url.hash}`);
		return true;
	}
</script>

{#if !inRoom && entry}
	{#if code !== undefined}
		<p class="problem" role="alert">
			{!valid
				? t('room.notACode')
				: player?.refusedReason === 'too-old'
					? t('room.tooOld')
					: status === 'closed'
						? t('room.closedByStoryteller')
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
			<!-- A camera icon, not words (Trevor, 2026-10-23). -->
			<IconButton icon="scan" label={t('share.scan')} onclick={() => (scanning = true)} />
			<!-- Grim view and Public Town are for fewer people, so they wait behind ⋯ and Join as
			     player stays the one big button (Trevor, 2026-10-26). -->
			<Menu
				label={t('room.moreWays')}
				items={[
					// Disabled until the room has a Grim view password.
					{
						value: 'grim-view',
						label: t('room.grimView'),
						disabled: !found?.grimView,
						onSelect: () => (grimViewOpen = true)
					},
					// A tablet for the middle of the table shows the players' grim (Public Town,
					// Trevor 2026-10-26).
					{
						value: 'town',
						label: t('room.town.title'),
						disabled: !canJoin,
						onSelect: () => {
							if (lookup) void goto(resolve('/town/[code]', { code: lookup.code }));
						}
					}
				]}
			/>
		</div>
	</form>
	<Dialog bind:open={scanning} title={t('share.scan')}>
		{#if scanning}<QrScanner onRead={scanned} problem={scanProblem} progress={scanProgress} />{/if}
	</Dialog>
	<Dialog bind:open={grimViewOpen} title={t('room.grimView')}>
		<form class="grim-view" onsubmit={grimView}>
			<TextField
				label={t('room.watch.password')}
				bind:value={grimPassword}
				maxlength={64}
				type="password"
				autocomplete="off"
				plain
			/>
			<ModalActions
				onCancel={() => (grimViewOpen = false)}
				disabled={!grimPassword.trim()}
				submit
			/>
		</form>
	</Dialog>
	{#if code === undefined}<YourGames
			onOpen={(c, town) => (town ? void goto(resolve('/town/[code]', { code: c })) : openRoom(c))}
		/>{/if}
{:else if inRoom}
	<div class="you-line">
		<!-- Where this phone sits; the name is set from You on the title line (plan E2, Trevor
		     2026-10-26: "move name into an edit button in the top"). -->
		<p class="you" data-testid="you-row">
			<span class="summary" role="status" data-testid="join-status">{summary}</span>
		</p>
		<!-- Only while the Storyteller lets players see their character (Trevor, 2026-10-26). -->
		{#if player}<YourCharacter {player} />{/if}
		<!-- Where the game is up to, with the day's timer (Trevor, 2026-10-26); it shares the
		     row's height, so nothing below moves. -->
		{#if phase}<PlayersDayStatus {phase} timer={dayTimer} />{/if}
		<!-- Only once the game is over (Trevor 2026-10-25); it shares the row's height, so nothing below moves. -->
		{#if view?.endedGameId}
			<Button aria-haspopup="dialog" onclick={() => (rating = true)}
				>{t('room.feedback.open')}</Button
			>
		{/if}
	</div>
	{#if player && balloting}<ScriptBallot {player} />{/if}
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
					>{#if s?.playerName}<PlayerBadge name={s.playerName} />{:else}{t('common.seat', {
							number: s?.seatNumber ?? 0
						})}{/if}</VoteChoice
				>
			</li>
		{/each}
	</ul>
</Dialog>

{#if player}<FeedbackSheet {player} bind:open={rating} />{/if}

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
	.grim-view {
		display: grid;
		gap: var(--space-4);
	}
	.code-form :global(.button) {
		min-width: calc(10 * var(--u));
	}
	.problem {
		margin: 0;
		color: var(--on-surface-muted);
	}
	/* Where this phone sits, with the ballot or Rate beside it, in one row over the tabs. */
	.you-line {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.you {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-2);
		box-sizing: border-box;
		min-width: 0;
		min-height: var(--tap-target);
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	/* Two lines reserved, so a longer status never moves the tabs. */
	.summary {
		flex: 1;
		min-width: 0;
		min-height: 2.8em;
		margin: 0;
		align-content: center;
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
