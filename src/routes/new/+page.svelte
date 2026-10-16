<script lang="ts">
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import NewGame from '#lib/features/grimoire/NewGame.svelte';
</script>

<svelte:head>
	<title>New game · Grim-Games</title>
</svelte:head>

<main>
	<ErrorBoundary area="grimoire">
		<NewGame />
	</ErrorBoundary>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
</style>
