<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import JoinPage from '#lib/features/room/JoinPage.svelte';
</script>

<svelte:head>
	<title>{`${t('room.joinTitle')} · ${APP_NAME}`}</title>
</svelte:head>

<JoinPage />
