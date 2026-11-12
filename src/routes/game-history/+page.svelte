<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import GameHistoryPage from '#lib/features/room/GameHistoryPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{`${t('room.gameHistory.title')} · ${APP_NAME}`}</title>
</svelte:head>

<GameHistoryPage />
