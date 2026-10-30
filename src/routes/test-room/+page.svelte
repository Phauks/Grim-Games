<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import TestRoomPage from '#lib/features/test-room/TestRoomPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{`${t('room.testRoom.title')} · ${APP_NAME}`}</title>
</svelte:head>

<TestRoomPage />
