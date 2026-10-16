<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import JoinPage from '#lib/features/room/JoinPage.svelte';
</script>

<svelte:head>
	<title>{`${t('room.joinTitle')} · Grim-Games`}</title>
</svelte:head>

<JoinPage />
