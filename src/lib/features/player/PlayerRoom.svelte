<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { resolve } from '$app/paths';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import JoinPanel from '#lib/features/room/JoinPanel.svelte';
	import { lastRoom } from '#lib/features/room/player.svelte.ts';

	/**
	 * /play's Room tab (Trevor, 2026-10-19): the live room this phone last joined, or the code
	 * form, so a player moves between the script and the room without leaving /play. The
	 * room's own link and QR are one icon away, to pass on to another player.
	 */
	let code = $state(lastRoom());
	let joined = $state(false);
	let sharing = $state(false);

	const link = $derived(
		code && joined ? `${location.origin}${resolve('/join/[code]', { code })}` : undefined
	);
</script>

<div class="room">
	<!-- The share icon is always here, disabled until the phone is in a room: nothing moves. -->
	<div class="head">
		<h2>
			{code && joined ? t('room.roomTitle', { code: formatRoomCode(code) }) : t('room.joinTitle')}
		</h2>
		<IconButton
			icon="share"
			label={t('player.shareRoom')}
			disabled={!link}
			onclick={() => (sharing = true)}
		/>
	</div>
	{#key code}
		<JoinPanel {code} onCode={(c) => (code = c)} onJoined={(j) => (joined = j)} />
	{/key}
</div>

<Dialog bind:open={sharing} title={t('player.shareRoom')}>
	<SharePanel
		url={link}
		title={t('room.joinTitle')}
		qrLabel={t('room.qrLabel')}
		pending={t('room.joining')}
		code={{ label: t('room.joinCode'), value: code && formatRoomCode(code) }}
		text={code ? t('room.shareText', { code: formatRoomCode(code) }) : undefined}
	/>
</Dialog>

<style>
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
