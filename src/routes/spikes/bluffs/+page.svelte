<script lang="ts">
	import PageMenuButton from '#lib/features/shell/PageMenuButton.svelte';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import BluffsDemo from '#lib/features/bluffs/BluffsDemo.svelte';
</script>

<svelte:head>
	<title>Demon bluffs spike · {APP_NAME}</title>
</svelte:head>

<PageMenuButton />

<main>
	<h1>Demon bluffs (preview)</h1>
	<p class="note">
		Sample games in memory: Trouble Brewing with a Drunk who thinks they are the Chef, and Bad Moon
		Rising with a Lunatic.
	</p>
	<div class="demos">
		<BluffsDemo />
		<BluffsDemo variant="bmr" />
	</div>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-4);
	}
	h1 {
		font-family: var(--font-heading);
	}
	.demos {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.note {
		color: var(--on-surface-muted);
	}
</style>
