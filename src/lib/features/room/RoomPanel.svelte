<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import ScriptSharePanel from '#lib/features/scripts/SharePanel.svelte';
	import { gameShareable } from '#lib/features/scripts/game-shareable.svelte.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { gameLine } from '#lib/features/player/byline.ts';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import { roomHost } from './host.svelte.ts';

	interface Props {
		game: OpenGame;
	}

	let { game }: Props = $props();

	const host = roomHost();
	$effect(() => host.attach(game));

	/** New code asks first. */
	let refreshOpen = $state(false);
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
</script>

<!--
	Share: the room code and QR, and who is in the room. Players join with just
	their name (Trevor, 2026-10-26: "we don't approve anymore"), and sit in the seat
	the board names with it ("I wanna drop the seat picking").
-->

<!-- One screen (Trevor, 2026-11-16): Grim view is given per person on Players, so the
     Grimoire tab and its password went. -->
{@render players()}

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
				onclick: () => (host.code ? (refreshOpen = true) : void host.open())
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
	title={t('room.refreshTitle')}
	danger
	onConfirm={() => void host.refreshRoom()}
>
	<p class="dialog-text">{t('room.refreshText')}</p>
</ConfirmDialog>

<style>
	.dialog-text {
		margin: 0;
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
	.status {
		min-height: 1.4em;
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>
