<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import NewGame from '#lib/features/grimoire/NewGame.svelte';
</script>

<svelte:head>
	<title>New game · Grim-Games</title>
</svelte:head>

<main>
	<!-- Back to the home screen (Trevor, 2026-10-16). -->
	<nav class="back">
		<Button href={resolve('/')} icon="back" variant="quiet">Back</Button>
	</nav>
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
	.back {
		margin-bottom: var(--space-2);
	}
</style>
