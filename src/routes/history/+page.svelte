<script lang="ts">
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import SavedGamesList from '#lib/features/grimoire/SavedGamesList.svelte';
	import HistoryStats from '#lib/features/history/HistoryStats.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{t('history.pageTitle')}</title>
</svelte:head>

<!-- History (Trevor, 2026-10-16): stats from the ended games first, then the games. -->
<main>
	<ErrorBoundary area="history">
		<div class="stats"><HistoryStats /></div>
	</ErrorBoundary>
	<ErrorBoundary area="grimoire">
		<SavedGamesList view="previous" />
	</ErrorBoundary>
</main>

<style>
	main {
		max-width: calc(64 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	.stats {
		display: grid;
		gap: var(--space-4);
		margin-bottom: var(--space-6);
	}
</style>
