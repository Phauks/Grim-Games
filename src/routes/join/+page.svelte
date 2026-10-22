<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerView from '#lib/features/player/PlayerView.svelte';
</script>

<svelte:head>
	<title>{`${t('room.joinTitle')} · ${APP_NAME}`}</title>
</svelte:head>

<!-- Join game is the player view's Room tab, with the code form (Trevor, 2026-10-19). -->
<PlayerView join={{}} />
