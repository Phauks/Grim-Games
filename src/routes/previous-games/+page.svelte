<script lang="ts">
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import SavedGamesList from '#lib/features/grimoire/SavedGamesList.svelte';
</script>

<svelte:head>
	<title>Previous games · Grim-Games</title>
</svelte:head>

<main>
	<ErrorBoundary area="grimoire">
		<SavedGamesList view="previous" />
	</ErrorBoundary>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
</style>
