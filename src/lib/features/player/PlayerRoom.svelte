<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import JoinPanel from '#lib/features/room/JoinPanel.svelte';
	import { lastRoom } from '#lib/features/room/player.svelte.ts';
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import ScriptQrCenter from '#lib/features/scripts/ScriptQrCenter.svelte';
	import ScriptByline from './ScriptByline.svelte';
	import { gameLine } from './byline.ts';

	/**
	 * /play's Room tab (Trevor, 2026-10-19): the live room this phone last joined, or the code
	 * form, so a player moves between the script and the room without leaving /play. The
	 * room's own link and QR are one icon away, to pass on to another player, on the same
	 * share screen as the script's (Trevor, 2026-10-19: the two share buttons should match).
	 */
	interface Props {
		/** The game's script, for the share screen's byline and the middle of its QR code. */
		script?: LoadedScript;
		version?: string;
		/**
		 * The room a join link named; null for Join game's code form; left out, the room this
		 * phone last joined.
		 */
		initialCode?: string | null;
		/** A typed code was entered; without it the tab switches rooms in place. */
		onCode?: (code: string) => void;
	}

	let { script, version, initialCode, onCode }: Props = $props();
	// svelte-ignore state_referenced_locally
	let code = $state(initialCode === undefined ? lastRoom() : (initialCode ?? undefined));
	const logo = $derived(script && scriptLogo(script));
	let logoFailed = $state(false);
	const roomTitle = $derived(code ? t('room.roomTitle', { code: formatRoomCode(code) }) : '');
	let joined = $state(false);
	let sharing = $state(false);

	// The Storyteller's name comes from the room; the share text names the game as its byline
	// does (Trevor, 2026-10-19).
	let storyteller = $state<string>();
	const gameText = $derived(
		gameLine(script?.name, {
			version,
			author: script?.meta.author,
			storyteller
		})
	);
	const shareText = $derived(
		!code
			? undefined
			: gameText
				? t('room.shareGameText', { game: gameText, code: formatRoomCode(code) })
				: t('room.shareText', { code: formatRoomCode(code) })
	);

	const link = $derived(
		code && joined ? `${location.origin}${resolve('/join/[code]', { code })}` : undefined
	);
</script>

<div class="room">
	<!-- The share icon is always here, disabled until the phone is in a room: nothing moves. -->
	<div class="head">
		<h2>
			{code && joined ? roomTitle : t('room.joinTitle')}
		</h2>
		<IconButton
			icon="share"
			label={t('player.shareRoom')}
			disabled={!link}
			onclick={() => (sharing = true)}
		/>
	</div>
	{#key code}
		<JoinPanel
			{code}
			onCode={(c) => (onCode ? onCode(c) : (code = c))}
			onJoined={(j) => (joined = j)}
			onStoryteller={(name) => (storyteller = name)}
		/>
	{/key}
</div>

<Dialog bind:open={sharing} title={t('scripts.share.title', { title: roomTitle })}>
	<div class="panel">
		<ScriptByline author={script?.meta.author} {version} />
		<SharePanel
			url={link}
			title={script?.name || roomTitle}
			qrLabel={t('room.qrLabel')}
			pending={t('room.joining')}
			code={{ label: t('room.joinCode'), value: code && formatRoomCode(code) }}
			text={shareText}
			qrCenterShape={logo && !logoFailed ? 'square' : 'wide'}
		>
			{#snippet qrCenter()}
				<ScriptQrCenter {logo} name={script?.name ?? ''} bind:failed={logoFailed} />
			{/snippet}
		</SharePanel>
	</div>
</Dialog>

<style>
	.panel {
		margin-top: var(--space-3);
	}
	.room {
		display: grid;
		gap: var(--space-3);
	}
	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--heading);
	}
</style>
