<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ThemeSheet from '#lib/features/settings/ThemeSheet.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import { releaseRoom, useRoom } from './room-connection.ts';
	import { joinedRoom } from './joined-room.svelte.ts';

	/**
	 * The player screen's settings cog, among the title's icon buttons, the same button as Print
	 * and Share beside it (Trevor, 2026-10-26: "Settings cog should be like other buttons for
	 * players"). It opens the board's looks (Theme) in a sheet, the Storyteller's More > Theme,
	 * since they left Settings (Trevor, 2026-11-18); the sheet's own cog opens the one Settings,
	 * where Settings > Player has this phone's name in a room. The board's Script shows it too
	 * (parity).
	 */
	interface Props {
		/** The room this phone is in; without one there is no name to set. */
		room?: string;
	}

	let { room }: Props = $props();

	let player = $state.raw<RoomPlayer>();
	$effect(() => {
		if (!room) return;
		const p = useRoom(room);
		player = p;
		const clear = joinedRoom.set(p);
		return () => {
			clear();
			releaseRoom(p);
			player = undefined;
		};
	});

	/** The name this phone shows in the room, once it has one. */
	const me = $derived(player?.view?.me.name);
	let themeOpen = $state(false);
</script>

<!-- The cog; its name says the name this phone shows in the room, once it has one. -->
<IconButton
	icon="settings"
	aria-haspopup="dialog"
	label={me ? t('room.settingsNamed', { name: me }) : t('settings.title')}
	data-testid="you-button"
	onclick={() => (themeOpen = true)}
/>
<ThemeSheet bind:open={themeOpen} />
