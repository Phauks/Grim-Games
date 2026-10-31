<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ScriptSharePanel from '#lib/features/scripts/SharePanel.svelte';
	import { gameShareable } from '#lib/features/scripts/game-shareable.svelte.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import CopyButton from '#lib/ui/share/CopyButton.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { gameLine } from '#lib/features/player/byline.ts';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { roomHost } from './host.svelte.ts';

	interface Props {
		game: OpenGame;
	}

	let { game }: Props = $props();

	let tab = $state<'players' | 'grimoire'>('players');

	const host = roomHost();
	$effect(() => host.attach(game));

	/**
	 * Grim view by password alone (Trevor, 2026-10-26: "access password locked by storyteller
	 * ... default to a new password per game (that can be customizable)"): a phone with the
	 * room code and it watches. Enter sets it; the eye shows it, as the Storyteller reads it out.
	 */
	let password = $derived(host.viewerPassword ?? '');
	function setPassword() {
		if (password.trim() !== (host.viewerPassword ?? '')) void host.setViewerPassword(password);
	}

	/** New code or New password asks first; which one stays set while the dialog closes. */
	let refreshOpen = $state(false);
	let refreshKind = $state<'room' | 'watch'>('room');
	function askRefresh(kind: 'room' | 'watch') {
		refreshKind = kind;
		refreshOpen = true;
	}
	const connected = $derived(host.status === 'open');
	// Seated players, and others from this game, stay listed while their phone sleeps; the room
	// also keeps phones from earlier games, which are left out (2026-10-25).
	const seated = $derived(
		host.members.filter(
			(m) =>
				m.name !== undefined &&
				(m.seatId !== undefined || host.unseatedInGame.some((u) => u.memberId === m.memberId))
		)
	);
	const statusText = $derived(
		!host.code
			? host.problem
				? t('room.openFailed')
				: host.opening
					? t('room.openingRoom')
					: ''
			: host.refusedReason === 'too-old'
				? t('room.tooOld')
				: host.status === 'open'
					? t('room.connected')
					: host.status === 'connecting'
						? t('room.connecting')
						: t('room.offline')
	);

	// The game's script in the middle of the QR: its logo, or its name (Trevor, 2026-10-19).
	// A script with neither leaves the middle as plain code.
	const loadedScript = $derived(
		officialData.current ? fromScript(game.game.script, officialData.current).script : undefined
	);
	const scriptName = $derived(loadedScript?.name ?? game.game.script.meta?.name ?? '');
	const logo = $derived(loadedScript && scriptLogo(loadedScript));
	/** The script's own link, for the offline code, as on the players' Share. */
	const target = $derived.by(() => {
		if (!loadedScript) return () => Promise.reject(new Error('No script yet'));
		const from = gameShareable(loadedScript);
		return () => shareTargetFor(from, location.origin);
	});

	// The panel exists to show the code, so it opens a room straight away (if hovering or
	// pressing the button that opened it hasn't already).
	host.prepare();

	// Shared and copied text carries the code as well as the link, so it can be typed at /join
	// if the link won't open. The link holds the code too, for apps that keep only the link.
	// It names the game as its byline does (Trevor, 2026-10-19): script, version, author and
	// Storyteller, each left out when unknown.
	const gameText = $derived(
		gameLine(scriptName, {
			version: scriptVersion(undefined, game.game.script.meta),
			author: game.game.script.meta?.author,
			storyteller: game.game.storytellerName
		})
	);
	const message = $derived(
		!host.code
			? ''
			: gameText
				? t('room.shareGameText', { game: gameText, code: formatRoomCode(host.code) })
				: t('room.shareText', { code: formatRoomCode(host.code) })
	);

	/*
	 * Share grim (Trevor, 2026-10-20, plan R5): once the game is over, the whole finished
	 * grimoire goes to the room's phones, once, after asking. In its place all game.
	 */
	let shareGrimOpen = $state(false);
	const canShareGrim = $derived(
		connected &&
			host.ended?.gameId === game.game.gameId &&
			host.revealed?.gameId !== game.game.gameId
	);
	function shareGrim() {
		if (!host.reveal(game)) toast(t('room.shareGrim.failed'));
	}
</script>

<!--
	Share: the room code and QR, and who is in the room. Players join with just
	their name (Trevor, 2026-10-26: "we don't approve anymore"), and sit in the seat
	the board names with it ("I wanna drop the seat picking").
-->

<!-- Two tabs (Trevor, 2026-10-31, picked from four mocked placements; it reverses 2026-10-22's
     "combine tabs"): Players, the code and QR they join with; Grimoire, everything that hands
     the grimoire to phones, Grim view while the game runs and Share grim once it is over.
     Steady, so switching never moves the tabs or what is under them. -->
<Tabs
	bind:value={tab}
	steady
	label={t('room.title')}
	tabs={[
		{ value: 'players', label: t('room.tab.players') },
		{ value: 'grimoire', label: t('room.tab.grimoire') }
	]}
>
	{#snippet panel(value)}
		{#if value === 'players'}{@render players()}{:else}{@render grimoire()}{/if}
	{/snippet}
</Tabs>

{#snippet grimoire()}
	<!-- Grim view (Specters, Trevor 2026-10-18): no QR or link of its own (Trevor, 2026-10-26:
	     "a second QR code for spoilers is unnecessary"), only a password with the room code. -->
	<section class="grimoire" data-testid="watch-link">
		<SettingToggle
			label={t('room.watch.toggle')}
			description={t('room.watch.hint')}
			checked={!!host.viewerKey}
			disabled={!host.code}
			onChange={(on) => void host.setViewers(on)}
		/>
		<div class="password">
			<TextField
				label={t('room.watch.password')}
				bind:value={password}
				maxlength={64}
				type="password"
				disabled={!host.viewerKey}
				oncommit={setPassword}
				testid="grim-view-password"
				plain
			/>
			<!-- Copy beside it, as the join code and link have (Trevor, 2026-10-27). -->
			<CopyButton
				label={t('room.watch.copy')}
				text={host.viewerPassword}
				failed={t('room.watch.copyFailed')}
				disabled={!host.viewerKey}
			/>
			<!-- A new one in one step, not off and on (Trevor, 2026-10-20). -->
			<IconButton
				icon="refresh"
				label={t('room.watch.refresh')}
				disabled={!host.viewerKey}
				onclick={() => askRefresh('watch')}
			/>
		</div>
		<!-- Who is watching, in its place before the room connects; a grimoire too large to send
		     says so here instead. -->
		<p class="status" role="status" data-testid="status-watching">
			{host.grimoireTooLarge
				? t('room.watch.tooLarge')
				: connected
					? t('room.watching', { count: host.watchers })
					: ''}
		</p>
		<div class="share-grim">
			<Button icon="share" disabled={!canShareGrim} onclick={() => (shareGrimOpen = true)}
				>{t('room.shareGrim.button')}</Button
			>
		</div>
	</section>
{/snippet}

{#snippet players()}
	<!-- Laid out the same before the room opens, so the code and QR arrive without a reflow.
	     The players' Share screen, header and offline code too (Trevor, 2026-10-27:
	     "Storyteller should have everything player screen has"). -->
	<ScriptSharePanel
		title={scriptName}
		author={game.game.script.meta?.author}
		version={scriptVersion(undefined, game.game.script.meta)}
		{logo}
		{target}
		room={host.code}
		hosting={{
			pending: host.problem ? t('room.openFailed') : t('room.openingRoom'),
			text: message || undefined,
			status: connection,
			refresh: {
				label: t('room.refresh'),
				disabled: host.opening,
				// No Open or Close room (Trevor, 2026-10-20): a room is just there while the
				// game is, and a new code replaces it, deleting the old room.
				onclick: () => (host.code ? askRefresh('room') : void host.open())
			}
		}}
	/>
{/snippet}

{#snippet connection()}
	<!-- Beside the join code it vouches for (2026-10-31, in place of the Status section): how
	     the room is doing, and how many players are in it. -->
	<p class="status connection" role="status" data-status={host.status}>
		{#if host.code}<span
				class="dot"
				class:live={connected}
				data-testid="connection-dot"
				aria-hidden="true"
			></span>{/if}<span>{statusText}</span>{#if connected}<span aria-hidden="true">·</span><span
				data-testid="status-players">{t('common.players', { count: seated.length })}</span
			>{/if}
	</p>
{/snippet}

<ConfirmDialog
	bind:open={refreshOpen}
	title={refreshKind === 'room' ? t('room.refreshTitle') : t('room.watch.refreshTitle')}
	danger
	onConfirm={() => void (refreshKind === 'room' ? host.refreshRoom() : host.refreshViewers())}
>
	<p class="dialog-text">
		{refreshKind === 'room' ? t('room.refreshText') : t('room.watch.refreshText')}
	</p>
</ConfirmDialog>

<ConfirmDialog bind:open={shareGrimOpen} title={t('room.shareGrim.title')} onConfirm={shareGrim}>
	<p class="dialog-text">{t('room.shareGrim.body')}</p>
</ConfirmDialog>

<style>
	.dialog-text {
		margin: 0;
	}
	.grimoire {
		display: grid;
		gap: var(--space-2);
		align-content: start;
		min-width: 0;
		max-width: 32rem;
		padding-top: var(--space-3);
	}
	.connection {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	/* Hollow while connecting or offline, filled once connected. */
	.dot {
		flex: none;
		width: 0.75em;
		height: 0.75em;
		border: 0.15em solid var(--on-surface-muted);
		border-radius: 50%;
	}
	.dot.live {
		border-color: var(--good);
		background: var(--good);
	}
	.share-grim {
		display: flex;
	}
	.password {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
	}
	.password > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	.status {
		min-height: 1.4em;
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
