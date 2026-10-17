<script lang="ts">
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import SavedGamesList from '#lib/features/grimoire/SavedGamesList.svelte';
	import HistoryStats from '#lib/features/history/HistoryStats.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
</script>

<svelte:head>
	<title>{t('history.pageTitle')}</title>
</svelte:head>

<!-- History (Trevor, 2026-10-16): stats from the ended games first, then the games. -->
<Page title={t('history.title')}>
	<ErrorBoundary area="history">
		<HistoryStats />
	</ErrorBoundary>
	<ErrorBoundary area="grimoire">
		<SavedGamesList view="previous" />
	</ErrorBoundary>
</Page>
