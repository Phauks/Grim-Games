<script lang="ts">
	import { resolve } from '$app/paths';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import HomeGames from '#lib/features/grimoire/HomeGames.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
</script>

<main>
	<!-- The page's name for screen readers; the header already shows it. -->
	<h1 class="visually-hidden">Grim-Games</h1>
	<ErrorBoundary area="grimoire">
		<HomeGames />
	</ErrorBoundary>

	<nav aria-label="Other views">
		<Button href={resolve('/scripts')} icon="script">Scripts</Button>
		<Button href={resolve('/play')} icon="script">Player view</Button>
	</nav>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
</style>
