<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerNameRow from './PlayerNameRow.svelte';
	import TextSizeRows from '#lib/features/settings/sections/TextSizeRows.svelte';
	import DensityRow from '#lib/features/player/DensityRow.svelte';
	import AvatarPictureRow from '#lib/features/player/AvatarPictureRow.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import { releaseRoom, useRoom } from './room-connection.ts';

	/**
	 * The player screen's own settings (plan E2, Trevor 2026-10-26: "easier access to
	 * accessibility, zoom, font size for players. Move name into an edit button in the top";
	 * then "a settings cog in player script view where they select various text sizes settings
	 * and their name"): a cog among the title's icon buttons, the same button as Print and Share
	 * beside it (Trevor, 2026-10-26: "Settings cog should be like other buttons for players"),
	 * opening one sheet with this phone's name in its room, then Text size, Pinch to zoom and
	 * the Script sheet's density, which change the page at once, as in Settings > Text and
	 * Settings > Player. The board's Script shows it too, without the name (parity).
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
</script>

<!-- The cog; its name says the name this phone shows in the room, once it has one. -->
<IconButton
	icon="settings"
	aria-haspopup="dialog"
	label={me ? t('room.yourSettingsNamed', { name: me }) : t('room.yourSettings')}
	data-testid="you-button"
	onclick={() => (open = true)}
/>

<!-- Every row changes the page at once; the name opens its own modal with Save (Trevor,
     2026-10-27). -->
<Dialog bind:open title={t('room.yourSettings')}>
	<div class="rows">
		{#if player}<PlayerNameRow {player} /><AvatarPictureRow name={me} />{/if}
		<TextSizeRows /><DensityRow />
	</div>
</Dialog>

<style>
	.rows {
		display: grid;
		min-width: 0;
	}
</style>
