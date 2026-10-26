<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import LiveGamesPage from '#lib/features/room/LiveGamesPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{`${t('room.liveGames.title')} · ${APP_NAME}`}</title>
</svelte:head>

<LiveGamesPage />
