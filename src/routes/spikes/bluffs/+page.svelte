<script lang="ts">
	import BluffsDemo from '#lib/features/bluffs/BluffsDemo.svelte';
</script>

<svelte:head>
	<title>Demon bluffs spike · Grim-Games</title>
</svelte:head>

<main>
	<h1>Demon bluffs (preview)</h1>
	<p class="note">A sample Trouble Brewing game in memory, until the grimoire board is built.</p>
	<BluffsDemo />
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
	.note {
		color: var(--on-surface-muted);
	}
</style>
