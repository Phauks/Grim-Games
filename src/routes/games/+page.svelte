<script lang="ts">
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import SavedGamesList from '#lib/features/grimoire/SavedGamesList.svelte';
</script>

<svelte:head>
	<title>Resume game · Grim-Games</title>
</svelte:head>

<Page title="Resume game">
	<ErrorBoundary area="grimoire">
		<SavedGamesList />
	</ErrorBoundary>
</Page>
