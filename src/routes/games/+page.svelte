<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import SavedGamesList from '#lib/features/grimoire/SavedGamesList.svelte';
</script>

<svelte:head>
	<title>Resume game · Grim-Games</title>
</svelte:head>

<main>
	<!-- Back to the home screen (Trevor, 2026-10-16). -->
	<nav class="back">
		<Button href={resolve('/')} icon="back" variant="quiet">Back</Button>
	</nav>
	<ErrorBoundary area="grimoire">
		<SavedGamesList />
	</ErrorBoundary>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	.back {
		margin-bottom: var(--space-2);
	}
</style>
