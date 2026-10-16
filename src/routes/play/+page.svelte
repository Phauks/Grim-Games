<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerView from '#lib/features/player/PlayerView.svelte';
</script>

<svelte:head>
	<title>{t('player.pageTitle')}</title>
</svelte:head>

<PlayerView />
