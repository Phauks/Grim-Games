<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextSizeRows from '#lib/features/settings/sections/TextSizeRows.svelte';
	import PlayerSizeRows from '#lib/features/player/PlayerSizeRows.svelte';
	import AvatarPictureRow from '#lib/features/player/AvatarPictureRow.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import { releaseRoom, useRoom } from './room-connection.ts';

	/**
	 * The player screen's own settings (plan E2, Trevor 2026-10-26: "easier access to
	 * accessibility, zoom, font size for players. Move name into an edit button in the top";
	 * then "a settings cog in player script view where they select various text sizes settings
	 * and their name"): a cog among the title's icon buttons, the same button as Print and Share
	 * beside it (Trevor, 2026-10-26: "Settings cog should be like other buttons for players"),
	 * opening one sheet with this phone's name in its room, then Text size and Pinch to zoom,
	 * which change the page at once, as in Settings > Text. The board's Script shows it too, without the name (parity).
	 */
	interface Props {
		/** The room this phone is in; without one there is no name to set. */
		room?: string;
	}

	let { room }: Props = $props();
	let open = $state(false);

	let player = $state.raw<RoomPlayer>();
	$effect(() => {
		if (!room) return;
		const p = useRoom(room);
		player = p;
		return () => {
			releaseRoom(p);
			player = undefined;
		};
	});

	/** The name this phone shows in the room, once it has one. */
	const me = $derived(player?.view?.me.name);
	let name = $state('');
	// Filled each time the sheet opens, from the room's name for this phone; a view arriving
	// later must not wipe a name being typed.
	$effect(() => {
		if (open) name = untrack(() => player?.view?.me.name ?? player?.savedName ?? '');
	});
	/** Saving the same name again changes nothing. */
	const unchanged = $derived(!!player?.view && name.trim() === player.view.me.name);

	/** Sends the name; a seated player keeps their seat, and a new one waits to be seated. */
	function save(event: SubmitEvent) {
		event.preventDefault();
		const n = name.trim();
		if (!n || !player) return;
		player.setName(n);
		open = false;
	}
</script>

<!-- The cog; its name says the name this phone shows in the room, once it has one. -->
<IconButton
	icon="settings"
	aria-haspopup="dialog"
	label={me ? t('room.yourSettingsNamed', { name: me }) : t('room.yourSettings')}
	data-testid="you-button"
	onclick={() => (open = true)}
/>

<Dialog bind:open title={t('room.yourSettings')}>
	<form onsubmit={save}>
		{#if player}
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
		{/if}
		<div class="rows">
			{#if player}<AvatarPictureRow name={name.trim() || me} />{/if}
			<TextSizeRows /><PlayerSizeRows />
		</div>
		{#if player}
			<ModalActions
				onCancel={() => (open = false)}
				submit
				disabled={!name.trim() || unchanged || player.status !== 'open'}
				confirmLabel={t('common.save')}
			/>
		{/if}
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		align-content: start;
		min-width: 0;
	}
	.rows {
		display: grid;
		min-width: 0;
	}
	input {
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
</style>
