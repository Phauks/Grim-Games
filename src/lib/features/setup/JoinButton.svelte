<script lang="ts">
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import RoomPanel from '#lib/features/room/RoomPanel.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	interface Props {
		game: OpenGame;
	}

	let { game }: Props = $props();
	let open = $state(false);
</script>

<!--
	The players' join code and QR from setup, so the Storyteller can share the script before
	the draw (Trevor, 2026-10-16). The same panel as the board's Players' phones.
-->
<IconButton icon="share" label={t('room.title')} onclick={() => (open = true)} />
<Dialog bind:open title={t('room.title')} size="full">
	<RoomPanel {game} />
</Dialog>
